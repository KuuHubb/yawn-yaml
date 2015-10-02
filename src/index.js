'use strict';

import {compose} from 'yaml-js';
import {load, dump} from 'js-yaml';
import {
  isArray,
  isString,
  isObject,
  isUndefined,
  isNull,
  isNumber,
  isEqual,
  repeat,
  each,
  contains,
  last,
  difference
} from 'lodash';

import YAWNError from './error.js';

const NULL_TAG = 'tag:yaml.org,2002:null';
const STR_TAG = 'tag:yaml.org,2002:str';
const INT_TAG = 'tag:yaml.org,2002:int';
const FLOAT_TAG = 'tag:yaml.org,2002:float';
const MAP_TAG = 'tag:yaml.org,2002:map';
const SEQ_TAG = 'tag:yaml.org,2002:seq';

const LINE_SEPERATOR = '\n';
const SPACE = ' ';
const DASH = '-';

// export default class YAWN {
export default class YAWN {

  constructor(str) {
    if (!isString(str)) {
      throw new TypeError('str should be a string');
    }

    this.yaml = str;
  }

  get json() {
    return load(this.yaml);
  }

  set json(newJson) {

    // if json is not changed do nothing
    if (isEqual(this.json, newJson)) {
      return;
    }

    const ast = compose(this.yaml);

    if (isUndefined(newJson)) {
      this.yaml = '';
      return;
    }

    // -------------------------------------------------------------------------
    // check if entire json is changed
    // -------------------------------------------------------------------------
    let newTag = getTag(newJson);

    if (ast.tag !== newTag) {
      let newYaml = cleanDump(newJson);

      // replace this.yaml value from start to end mark with newYaml if node is
      // primitive
      if (!isObject(newJson)) {
        this.yaml = replacePrimitive(ast, newYaml, this.yaml);

      // if node is not primitive
      } else {
        this.yaml = replaceNode(ast, newYaml, this.yaml);
      }

      return;
    }

    // -------------------------------------------------------------------------
    // NULL_TAG, STR_TAG, INT_TAG, FLOAT_TAG
    // -------------------------------------------------------------------------
    if (contains([NULL_TAG, STR_TAG, INT_TAG, FLOAT_TAG], ast.tag)) {
      this.yaml = replacePrimitive(ast, newJson, this.yaml);

      return;
    }


    // -------------------------------------------------------------------------
    // MAP_TAG
    // -------------------------------------------------------------------------
    if (ast.tag === MAP_TAG) {
      let json = this.json;

      each(ast.value, pair => {
        let [keyNode, valNode] = pair;

        // node is deleted
        if (isUndefined(newJson[keyNode.value])) {
          this.yaml = this.yaml.substr(0, keyNode.start_mark.pointer) +
            this.yaml.substring(getNodeEndMark(valNode).pointer);
          return;
        }

        let value = json[keyNode.value];
        let newValue = newJson[keyNode.value];

        // only primitive value
        if (newValue !== value && !isArray(valNode.value)) {
          this.yaml = replacePrimitive(valNode, newValue, this.yaml);
        }
      });

      // look for new items to add
      each(newJson, (value, key)=> {

        // item is new
        if (isUndefined(this.json[key])) {
          let newValue = cleanDump({[key]: value});
          this.yaml = insertAfterNode(ast, newValue, this.yaml);
        }
      });
    }

    // -------------------------------------------------------------------------
    // SEQ_TAG
    // -------------------------------------------------------------------------
    if (ast.tag === SEQ_TAG) {
      let values = ast.value.map(item => item.value);

      // new items in newJson
      difference(newJson, values).forEach((newItem)=> {
        this.yaml = insertAfterNode(ast, cleanDump([newItem]), this.yaml);
      });

      // deleted items in newJson
      difference(values, newJson).forEach((deletedItem)=> {

        // find the node for this item
        each(ast.value, node => {
          if (isEqual(node.value, deletedItem)) {

            // remove it from yaml
            this.yaml = removeArrayElement(ast, node, this.yaml);
          }
        });
      });
    }

      // each(ast.value, (itemNode)=> {

      //   // primitive value
      //   if (!isObject(itemNode.value)) {

      //     // value is new
      //     if (!contains(newJson, itemNode.value)) {
      //       this.yaml = replacePrimitive(itemNode, '', this.yaml);
      //     }
      //   }
      // });

      // each(newJson, (item)=> {

      //   if (!isObject(item)) {
      //     if (!contains(values, item)) {

      //     }

      //   }
      // });
  }

  toString() {
    return this.yaml;
  }

  toJSON() {
    return this.json;
  }
}

/*
 * Determines the AST tag of a JSON object
 *
 * @param {any} - json
 * @returns {boolean}
 * @throws {YAWNError} - if json has weird type
*/
function getTag(json) {
  let tag = null;

  if (isArray(json)) {
    tag = SEQ_TAG;
  } else if (isObject(json)) {
    tag = MAP_TAG;
  } else if (isNull(json)) {
    tag = NULL_TAG;
  } else if (isNumber(json)) {
    if (json % 10 === 0) {
      tag = INT_TAG;
    } else {
      tag = FLOAT_TAG;
    }
  } else if (isString(json)) {
    tag = STR_TAG;
  } else {
    throw new YAWNError('Unknown type');
  }
  return tag;
}

/*
 * Place value in node range in yaml string
 *
 * @param node {Node}
 * @param value {any}
 * @param yaml {string}
 *
 * @returns {string}
*/
function replacePrimitive(node, value, yaml) {
  return yaml.substr(0, node.start_mark.pointer) +
    String(value) +
    yaml.substring(node.end_mark.pointer);
}

/*
 * Place value in node range in yaml string
 *
 * @param node {Node}
 * @param value {any}
 * @param yaml {string}
 *
 * @returns {string}
*/
function replaceNode(node, value, yaml) {
  let indentedValue = indent(value, node.start_mark.column);
  let lineStart = node.start_mark.pointer - node.start_mark.column;

  return yaml.substr(0, lineStart) +
    indentedValue +
    yaml.substring(getNodeEndMark(node).pointer);
}

/*
 * Place value after node range in yaml string
 *
 * @param node {Node}
 * @param value {any}
 * @param yaml {string}
 *
 * @returns {string}
*/
function insertAfterNode(node, value, yaml) {
  let indentedValue = indent(value, node.start_mark.column);

  return yaml.substr(0, getNodeEndMark(node).pointer) +
    LINE_SEPERATOR +
    indentedValue +
    yaml.substring(getNodeEndMark(node).pointer);
}

/*
 * Removes an element from array
 *
 * @param {AST} ast
 * @param {Node} element
 * @param {string} yaml
 *
 * @returns {string}
*/
function removeArrayElement(ast, element, yaml) {

  // FIXME: Removing element from a YAML like `[a,b]` won't work with this.

  // find index of DASH(`-`) character for this array
  let index = element.start_mark.pointer;
  while(index > 0 && yaml[index] != DASH) {
    index--;
  }

  return yaml.substr(0, index) +
    yaml.substring(element.end_mark.pointer);
}


/*
 * Gets end mark of an AST
 *
 * @param {Node} ast
 *
 * @retusns {Mark}
*/
function getNodeEndMark(ast) {
  if (isArray(ast.value)) {
    let lastItem = last(ast.value);

    if (isArray(lastItem)) {
      return getNodeEndMark(last(lastItem));
    }
    return getNodeEndMark(lastItem);
  }

  return ast.end_mark;
}

/*
 * Indents a string with number of characters
 *
 * @param {string} str
 * @param {integer} depth - can be negative also
 *
 * @returns {string}
*/
function indent(str, depth) {
  return str
    .split(LINE_SEPERATOR)
    .filter(line => line)
    .map(line => repeat(SPACE, depth) + line)
    .join(LINE_SEPERATOR);
}

function cleanDump(value) {
  return dump(value).replace(/\n$/, '');
}

// TODO: fix UMD exports...
if (typeof window !== 'undefined') {
  window.YAWN = YAWN;
}