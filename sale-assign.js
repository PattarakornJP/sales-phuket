/**
 * เปลี่ยนเซลล์ผู้รับผิดชอบ แล้วให้หน้าแผนที่กับหน้าภาระงานเห็นตรงกัน
 *
 * เก็บใน localStorage ของเบราว์เซอร์ (คีย์เดียวกันทั้งสองหน้า
 * เพราะอยู่บน github.io โดเมนเดียวกัน) แบบเดียวกับที่ย้ายหมุดแล้วจำบนเครื่องนี้
 * ไม่เขียนทับชีตงาน PE Jobs — ชีตนั้นเป็นพิกัดงาน ไม่ใช่รายชื่อลูกค้าของเซลล์
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SaleAssign = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var STORE_KEY = 'pac-sale-assign-v1';

  function norm(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  }

  function assignKey(company, hotel, baseSale) {
    return norm(company) + '\n' + norm(hotel) + '\n' + norm(baseSale);
  }

  function storageOf(storage) {
    if (storage) return storage;
    try { return typeof localStorage !== 'undefined' ? localStorage : null; }
    catch (e) { return null; }
  }

  function readStore(storage) {
    var box = storageOf(storage);
    if (!box) return {};
    try {
      var obj = JSON.parse(box.getItem(STORE_KEY) || '{}');
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
      return obj;
    } catch (e) {
      return {};
    }
  }

  function writeStore(obj, storage) {
    var box = storageOf(storage);
    if (!box) return;
    box.setItem(STORE_KEY, JSON.stringify(obj || {}));
  }

  function lookup(store, company, hotel, baseSale) {
    var hit = store && store[assignKey(company, hotel, baseSale)];
    if (!hit || !norm(hit.sale) || !norm(hit.nick)) return null;
    return { sale: norm(hit.sale), nick: norm(hit.nick) };
  }

  function setAssignment(store, company, hotel, baseSale, sale, nick) {
    var next = {};
    var src = store || {};
    Object.keys(src).forEach(function (k) { next[k] = src[k]; });
    var key = assignKey(company, hotel, baseSale);
    if (!norm(sale) || !norm(nick) || norm(sale) === norm(baseSale)) delete next[key];
    else next[key] = { sale: norm(sale), nick: norm(nick) };
    return next;
  }

  function saleOf(row) {
    return norm(row && (row.s || row.sale));
  }

  function workloadStats(rows, people) {
    var byCompany = {};
    (rows || []).forEach(function (r) {
      var c = norm(r.c);
      var sale = saleOf(r);
      if (!byCompany[c]) byCompany[c] = {};
      byCompany[c][sale] = true;
    });
    return (people || []).map(function (p) {
      var sale = norm(p.sale);
      var mine = (rows || []).filter(function (r) { return saleOf(r) === sale; });
      var shared = mine.filter(function (r) {
        return Object.keys(byCompany[norm(r.c)] || {}).length > 1;
      }).length;
      return {
        sale: p.sale,
        nick: p.nick,
        total: mine.length,
        shared: shared,
        solo: mine.length - shared
      };
    });
  }

  function sharedCustomerCount(rows) {
    var byCompany = {};
    (rows || []).forEach(function (r) {
      var c = norm(r.c);
      if (!byCompany[c]) byCompany[c] = {};
      byCompany[c][saleOf(r)] = true;
    });
    var n = 0;
    Object.keys(byCompany).forEach(function (c) {
      if (Object.keys(byCompany[c]).length > 1) n++;
    });
    return n;
  }

  return {
    STORE_KEY: STORE_KEY,
    norm: norm,
    assignKey: assignKey,
    readStore: readStore,
    writeStore: writeStore,
    lookup: lookup,
    setAssignment: setAssignment,
    workloadStats: workloadStats,
    sharedCustomerCount: sharedCustomerCount
  };
});
