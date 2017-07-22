'use strict';

const sinon = require('sinon');
const test = require('./tape');
const Queue = require('../queue').Queue;

/**
 *
 * @type {Queue[]}
 */
const queues = [];

/**
 * @param onEachTask
 * @param [delay]
 * @returns {Queue}
 */
function createQueue(onEachTask, delay = 0) {
    const queue = new Queue(onEachTask, delay);
    queue.start();
    queues.push(queue);
    return queue;
}

// dispose all queues on tests finish
test.onFinish(() => {
    queues.forEach((q) => q.stop());
});

test('Should handle tasks one by one', (t) => {
    const tasks = ['task1', 'task2', 'task3'];
    let i = 0;
    const onEachTask = (task, done) => {
        t.equal(task, tasks[i++]);
        done();
    };

    const queue = createQueue(onEachTask);
    tasks.forEach((task) => queue.push(task));

    t.plan(3);
});

test('Should wait until done() is called', (t) => {
    const tasks = ['task1', 'task2', 'task3'];
    let i = 0;
    const onEachTask = (task, done) => {
        t.equal(task, tasks[i++]);

        if (i === 0) {
            done();
        }
    };

    const queue = createQueue(onEachTask);
    tasks.forEach((task) => queue.push(task));

    t.plan(1);
});

test('Should handle tasks with a delay', (t) => {
    const clock = sinon.useFakeTimers();
    const tasks = [false, false, false];
    let i = 0;
    const onEachTask = (task, done) => {
        tasks[i++] = true;
        done();
    };

    const queue = createQueue(onEachTask, 200);
    tasks.forEach((task) => queue.push(task));

    clock.tick(200);
    t.deepEqual(tasks, [true, false, false]);

    clock.tick(200);
    t.deepEqual(tasks, [true, true, false]);

    clock.tick(200);
    t.deepEqual(tasks, [true, true, true]);

    clock.restore();
    t.end();
});

test('Should handle tasks added after queue is started', (t) => {
    const expTask = 'some task';

    const onEachTask = (task, done) => {
        t.equal(task, expTask);
        t.end();
        done();
    };

    const queue = createQueue(onEachTask);
    queue.push(expTask);
});