const assert = require('assert');
const Sale = require('./sale-assign.js');

function mem() {
  const box = {};
  return {
    getItem: k => (Object.prototype.hasOwnProperty.call(box, k) ? box[k] : null),
    setItem: (k, v) => { box[k] = String(v); }
  };
}

const people = [
  { nick: 'พี่กร', sale: 'คุณภัทรกร จุมพล' },
  { nick: 'น้องเบบี้', sale: 'คุณกานดา ยามาสัน' }
];
const rows = [
  { c: 'A', s: 'คุณภัทรกร จุมพล' },
  { c: 'B', s: 'คุณภัทรกร จุมพล' },
  { c: 'B', s: 'คุณกานดา ยามาสัน' },
  { c: 'C', s: 'คุณกานดา ยามาสัน' }
];

const base = Sale.workloadStats(rows, people);
assert.deepStrictEqual(base.map(s => [s.nick, s.total, s.shared, s.solo]), [
  ['พี่กร', 2, 1, 1],
  ['น้องเบบี้', 2, 1, 1]
]);
assert.strictEqual(Sale.sharedCustomerCount(rows), 1);

const moved = rows.map(r => Object.assign({}, r));
moved[2].s = 'คุณภัทรกร จุมพล';
const after = Sale.workloadStats(moved, people);
assert.deepStrictEqual(after.map(s => [s.nick, s.total, s.shared, s.solo]), [
  ['พี่กร', 3, 0, 3],
  ['น้องเบบี้', 1, 0, 1]
]);
assert.strictEqual(Sale.sharedCustomerCount(moved), 0);

const store = Sale.setAssignment({}, 'บริษัท ทดสอบ', 'โรงแรม ก', 'คุณกานดา ยามาสัน', 'คุณภัทรกร จุมพล', 'พี่กร');
assert.deepStrictEqual(
  Sale.lookup(store, '  บริษัท   ทดสอบ ', 'โรงแรม ก', 'คุณกานดา ยามาสัน'),
  { sale: 'คุณภัทรกร จุมพล', nick: 'พี่กร' }
);
assert.strictEqual(
  Sale.lookup(store, 'บริษัท ทดสอบ', 'โรงแรม อื่น', 'คุณกานดา ยามาสัน'),
  null
);
const cleared = Sale.setAssignment(store, 'บริษัท ทดสอบ', 'โรงแรม ก', 'คุณกานดา ยามาสัน', 'คุณกานดา ยามาสัน', 'น้องเบบี้');
assert.strictEqual(Sale.lookup(cleared, 'บริษัท ทดสอบ', 'โรงแรม ก', 'คุณกานดา ยามาสัน'), null);
assert.deepStrictEqual(cleared, {});

const box = mem();
Sale.writeStore(store, box);
assert.deepStrictEqual(Sale.readStore(box), store);
box.setItem(Sale.STORE_KEY, '{not json');
assert.deepStrictEqual(Sale.readStore(box), {});

const other = Sale.setAssignment(store, 'อีกบริษัท', '', 'คุณภัทรกร จุมพล', 'คุณกานดา ยามาสัน', 'น้องเบบี้');
assert.deepStrictEqual(Sale.lookup(other, 'บริษัท ทดสอบ', 'โรงแรม ก', 'คุณกานดา ยามาสัน').nick, 'พี่กร');
assert.deepStrictEqual(Sale.lookup(other, 'อีกบริษัท', '', 'คุณภัทรกร จุมพล').nick, 'น้องเบบี้');

console.log('sale-assign tests ok');
