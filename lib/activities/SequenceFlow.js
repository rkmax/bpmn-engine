'use strict';

const debug = require('debug')('bpmn-engine:activity:sequenceFlow');
const EventEmitter = require('events').EventEmitter;
const util = require('util');
const vm = require('vm');

const internals = {};

module.exports = internals.Activity = function(activity, parent) {
  this.id = activity.element.id;
  debug(`<${this.id}>`, 'init');

  this.activity = activity;
  this.target = parent.getSequenceFlowTarget(activity.element.id);
  this.isDefault = parent.isDefaultSequenceFlow(activity.element.id);
  this.taken = false;
};

util.inherits(internals.Activity, EventEmitter);

internals.Activity.prototype.take = function(variables) {
  if (this.activity.element.conditionExpression) {
    this.taken = this.executeCondition(variables);
  } else {
    this.taken = true;
  }
  this.discarded = false;

  if (this.taken) {
    debug(`<${this.id}>`, `taken, target <${this.target.id}>`);
    asyncEmitEvent.call(this, 'taken', variables);
  } else {
    return this.discard(variables);
  }

  return this.taken;
};

internals.Activity.prototype.discard = function(variables, rootFlow) {
  if (rootFlow && rootFlow.id === this.id) {
    debug(`<${this.id}>`, `detected loop <${rootFlow.id}>. Exiting!`);
    return;
  }

  debug(`<${this.id}>`, `discarded, target <${this.target.id}>`);
  this.discarded = true;
  asyncEmitEvent.call(this, 'discarded', variables, rootFlow);
};

internals.Activity.prototype.executeCondition = function(variables) {
  const script = new vm.Script(this.activity.element.conditionExpression.body, {
    filename: `${this.id}.condition`,
    displayErrors: true
  });
  const context = new vm.createContext({
    context: variables
  });
  const result = script.runInContext(context);
  debug(`<${this.id}>`, `condition result evaluated to ${result}`);
  return result;
};

function asyncEmitEvent(eventName, variables, rootFlow) {
  setImmediate(() => {
    this.emit(eventName, this, variables, rootFlow);
  });
}