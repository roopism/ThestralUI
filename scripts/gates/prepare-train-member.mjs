import { prepareTrainMember } from './train-checks.mjs';

await prepareTrainMember(JSON.parse(process.argv[2]));
