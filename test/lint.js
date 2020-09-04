
import eslint from 'eslint';
const { CLIEngine } = eslint;

const engine = new CLIEngine({});
const formatter = engine.getFormatter();

import path from 'path';

import { fileURLToPath } from 'url';
const dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url))) + '/';

const root = path.dirname(dirname);

describe('Running eslint validation', () => {

  const results = engine.executeOnFiles([
    path.resolve(root, 'src/*.js'),
    path.resolve(root, 'test/*.js')
  ]).results;

  results.forEach(result =>
    it(`expecting '${path.relative(root, result.filePath)}' to lint cleanly`, done => {
      const { errorCount, warningCount } = result;
      if (errorCount || warningCount) {
        done(new Error(formatter([result])));
      } else {
        done();
      }
    })
  );

});
