export function budgetFailures(measured, budgets) {
  const keys = Object.keys(budgets).sort();
  if (keys.join() !== Object.keys(measured).sort().join())
    return ['Missing or unbudgeted runtime metric.'];
  return keys.flatMap((key) => {
    const value = measured[key];
    const { baseline, allowance } = budgets[key];
    if (
      ![value, baseline, allowance].every(Number.isFinite) ||
      baseline < 0 ||
      allowance < 0 ||
      value < 0 ||
      value > baseline + allowance
    ) {
      return [
        key + ' measured ' + value + ', baseline ' + baseline + ', allowed increase ' + allowance,
      ];
    }
    return [];
  });
}
