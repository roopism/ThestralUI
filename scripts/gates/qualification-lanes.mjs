import assert from 'node:assert/strict';

const functionalStages = ['mac', 'iphone', 'android'];
const timedStages = ['macPerformance', 'androidTiming'];
const now = () => new Date().toISOString();
const message = error => (error?.message ?? String(error)) || 'Unspecified error';

// A reservation must invoke its callback exactly once and hold its lease until
// completion. Even a broken adapter cannot leave a child running into timing.
async function reserved(name, reserve, operation) {
  let work, released = false, done = false, failure;
  try {
    await reserve(env => {
      if (released || work) {
        failure = Error(name + ' requires one active reservation');
        throw failure;
      }
      work = Promise.resolve().then(() => operation(env)).finally(() => { done = true; });
      return work;
    });
  } catch (error) { failure ??= Error(message(error)); }
  released = true;
  if (!work || !done) failure ??= Error(name + ' reservation ended without a completed operation');
  const value = await work;
  return { value, error: failure && message(failure) };
}

// ready checks the individual stage's real prerequisites. Operations return an
// explicit verdict after their children exit. record synchronously saves the receipt.
export async function runQualificationLanes({ functional, timed, ready, reserveTiming, record,
  reserveFunctional = run => run(), audit }) {
  for (const stage of functionalStages) assert.equal(typeof functional?.[stage], 'function', stage);
  for (const stage of timedStages) assert.equal(typeof timed?.[stage], 'function', stage);
  for (const fn of [ready, reserveFunctional, reserveTiming, record]) assert.equal(typeof fn, 'function');
  if (audit !== undefined) assert.equal(typeof audit, 'function');
  const results = {};
  let reservationError;
  function save(stage, row) {
    const saved = record(stage, { ...row });
    assert.ok(!saved?.then, 'Stage records require synchronous persistence');
    results[stage] = row;
  }
  function finish(stage, result, reason) {
    const finished = now();
    // A blocked stage performed no work. Its start and end mark the decision.
    save(stage, { result, started: results[stage]?.started ?? finished, finished, ...(reason ? { reason } : {}) });
  }
  async function run(stage, operation, env, useTiming = false) {
    if (useTiming && reservationError) return finish(stage, 'blocked', reservationError);
    if (stage !== 'audit') {
      let available;
      try { available = await ready(stage); }
      catch (error) { return finish(stage, 'blocked', message(error)); }
      if (available !== true) return finish(stage, 'blocked', 'Prerequisite unavailable for ' + stage);
    }
    async function perform(leaseEnv) {
      save(stage, { result: 'running', started: now(), finished: null });
      try {
        const verdict = await operation(leaseEnv);
        assert.ok(['passed', 'failed', 'blocked'].includes(verdict?.result), 'Missing stage verdict for ' + stage);
        return verdict;
      } catch (error) { return { result: 'failed', reason: message(error) }; }
    }
    let verdict;
    if (useTiming) {
      const held = await reserved(stage, enter => reserveTiming(stage, enter), perform);
      if (held.error) {
        reservationError = 'Timing reservation for ' + stage + ': ' + held.error;
        return finish(stage, 'failed', [held.value?.reason, reservationError].filter(Boolean).join(' / '));
      }
      verdict = held.value;
    } else verdict = await perform(env);
    finish(stage, verdict.result, verdict.reason);
  }

  const wave = await reserved('Functional wave', reserveFunctional, async env => {
    const outcomes = await Promise.allSettled(functionalStages.map(stage => run(stage, functional[stage], env)));
    if (audit) await run('audit', audit, env);
    const errors = outcomes.filter(row => row.status === 'rejected').map(row => row.reason);
    if (errors.length) throw new AggregateError(errors, 'Unable to persist functional stage outcomes');
  });
  if (wave.error) {
    reservationError = 'Functional reservation: ' + wave.error;
    finish('functionalReservation', 'failed', reservationError);
    for (const stage of [...functionalStages, ...(audit ? ['audit'] : [])])
      if (!results[stage]) finish(stage, 'blocked', reservationError);
  }
  for (const stage of timedStages) await run(stage, timed[stage], undefined, true);
  return results;
}
