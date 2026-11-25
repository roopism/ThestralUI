import { readFileSync } from 'node:fs';

const limits = JSON.parse(readFileSync(new URL('./guardrails.json', import.meta.url)));
export const flakeWindow = limits.flakeWindow;
const fresh = reason => ({reuse:false,reason});

export function reuseDecision({mode,groupId,reusable,record,freshHistory,audit,now = Date.now()}) {
  if (mode !== 'qualification') return fresh('full fresh run');
  if (limits.minAuditGroups !== 1 || reusable !== true || limits.neverGroups.includes(groupId)) return fresh('group requires a fresh run');
  if (!record || record.result !== 'passed' || record.groupId !== groupId) return fresh('no matching pass');
  const age = now - Date.parse(record.createdAt);
  if (!(age >= 0 && age < limits.ttlHours * 3600000)) return fresh('record expired or has invalid time');
  if (record.retries !== 0) return fresh('source retried');
  if (!Array.isArray(freshHistory) || !freshHistory.length ||
      freshHistory.slice(0, flakeWindow).some(result => result !== 'passed')) return fresh('recent failure or unknown history');
  if (audit) return fresh('selected for fresh audit');
  return {reuse:true,reason:'matching inputs and verified fresh pass'};
}
