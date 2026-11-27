// A dedicated machine must attest its host and device fingerprints and provide
// its calibration and limits. A recorded owner decision precedes activation.
export async function measure() {
  throw Error('Dedicated Android timing is not available on this host');
}
