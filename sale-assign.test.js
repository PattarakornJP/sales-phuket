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

const sheetRows = [
  { company: 'บริษัท ทดสอบ', hotel: 'โรงแรม ก', baseSale: 'คุณกานดา ยามาสัน', sale: 'คุณภัทรกร จุมพล', nick: 'พี่กร' },
  { company: 'เก่า', hotel: '', baseSale: 'คุณภัทรกร จุมพล', sale: 'คุณภัทรกร จุมพล', nick: 'พี่กร' }
];
assert.deepStrictEqual(Sale.rowsToStore(sheetRows), {
  [Sale.assignKey('บริษัท ทดสอบ', 'โรงแรม ก', 'คุณกานดา ยามาสัน')]: { sale: 'คุณภัทรกร จุมพล', nick: 'พี่กร' }
});
assert.strictEqual(Sale.isSaleAssignPack({ ok: true, action: 'saleAssign', rows: [] }), true);
assert.strictEqual(Sale.isSaleAssignPack({ ok: true, count: 128, rows: [{ id: 1 }] }), false);

const box2 = mem();
Sale.writeStore({
  [Sale.assignKey('ในเครื่อง', '', 'คุณกานดา ยามาสัน')]: { sale: 'คุณภัทรกร จุมพล', nick: 'พี่กร' }
}, box2);
Sale.writeStore(Sale.readStore(box2), box2);
const dirtyKey = Sale.assignKey('ในเครื่อง', '', 'คุณกานดา ยามาสัน');
box2.setItem(Sale.DIRTY_KEY, JSON.stringify({ [dirtyKey]: 'set' }));
const adopted = Sale.adoptRemote(sheetRows, box2);
assert.strictEqual(adopted[Sale.assignKey('บริษัท ทดสอบ', 'โรงแรม ก', 'คุณกานดา ยามาสัน')].nick, 'พี่กร');
assert.strictEqual(adopted[dirtyKey].nick, 'พี่กร');
box2.setItem(Sale.DIRTY_KEY, JSON.stringify({
  [Sale.assignKey('บริษัท ทดสอบ', 'โรงแรม ก', 'คุณกานดา ยามาสัน')]: 'del'
}));
const removed = Sale.adoptRemote(sheetRows, box2);
assert.strictEqual(removed[Sale.assignKey('บริษัท ทดสอบ', 'โรงแรม ก', 'คุณกานดา ยามาสัน')], undefined);

const payload = Sale.saleAssignPayload('บริษัท ทดสอบ', 'โรงแรม ก', 'คุณกานดา ยามาสัน', 'คุณภัทรกร จุมพล', 'พี่กร', 'test-key');
assert.strictEqual(payload.action, 'saleAssign');
assert.strictEqual(Object.prototype.hasOwnProperty.call(payload, 'rows'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(payload, 'table'), false);
assert.strictEqual(payload.sale, 'คุณภัทรกร จุมพล');

const kept = Sale.remember('บริษัท ทดสอบ', 'โรงแรม ก', 'คุณกานดา ยามาสัน', 'คุณภัทรกร จุมพล', 'พี่กร', box2);
assert.strictEqual(Sale.lookup(kept, 'บริษัท ทดสอบ', 'โรงแรม ก', 'คุณกานดา ยามาสัน').nick, 'พี่กร');
assert.strictEqual(Sale.readDirty(box2)[Sale.assignKey('บริษัท ทดสอบ', 'โรงแรม ก', 'คุณกานดา ยามาสัน')], 'set');
Sale.remember('บริษัท ทดสอบ', 'โรงแรม ก', 'คุณกานดา ยามาสัน', 'คุณกานดา ยามาสัน', 'น้องเบบี้', box2);
assert.strictEqual(Sale.lookup(Sale.readStore(box2), 'บริษัท ทดสอบ', 'โรงแรม ก', 'คุณกานดา ยามาสัน'), null);
assert.strictEqual(Sale.readDirty(box2)[Sale.assignKey('บริษัท ทดสอบ', 'โรงแรม ก', 'คุณกานดา ยามาสัน')], 'del');

console.log('sale-assign tests ok');
