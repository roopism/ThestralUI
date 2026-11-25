const portBases = { MAIN: 6006, W1: 6106, W2: 6206, W3: 6306, C1: 6406, C2: 6506, C3: 6606, C4: 6706, C5: 6806, C6: 6906, C7: 7006 };

export function workerPorts(holder) {
  if (!Object.hasOwn(portBases, holder)) throw Error('Expected MAIN, W1–W3 or C1–C7');
  return portBases[holder];
}

export function servicePorts(value = process.env.ULD_PORT_BASE ?? '6006') {
  if (!Object.values(portBases).some(port => String(port) === String(value)))
    throw Error('ULD_PORT_BASE must be the assigned MAIN, W1–W3 or C1–C7 port base');
  const base = Number(value);
  return { catalog: base, preview: base + 1, visual: base + 2 };
}
