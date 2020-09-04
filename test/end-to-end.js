import chai from 'chai';
const {expect} = chai;
import {readFileSync, readdirSync} from 'fs';
import jsYaml from 'js-yaml';
const {load} = jsYaml;
import YAWN from '../src/index.js';
import path from 'path';
import {fileURLToPath} from 'url';

const dirname = path.dirname(fileURLToPath(import.meta.url)) + '/';

describe('end to end', ()=> {

  readdirSync(path.join(dirname, 'end-to-end')).forEach(testCase=> {

    it(`preserves comments and styling for test case ${testCase}`, ()=> {

      const p = path.join(dirname, 'end-to-end', testCase);
      const input = readFileSync(path.join(p, 'input.yaml')).toString();
      const output = readFileSync(path.join(p, 'output.yaml')).toString();
      const newJson = load(output);

      const yawn = new YAWN(input);
      yawn.json = newJson;

      expect(yawn.yaml).to.equal(output);
    });
  });
});
