/**
 * เปลี่ยนเซลล์ผู้รับผิดชอบ
 *
 * ที่เก็บหลักคือแท็บ sale_assign บนชีต PE Jobs (คนละแท็บกับงาน)
 * localStorage เป็นสำเนาบนเครื่องนี้ ใช้เมื่อชีตยังไม่พร้อมหรือออฟไลน์
 * จะส่งขึ้นชีตก็ต่อเมื่อเซิร์ฟเวอร์ตอบ action=saleAssign เท่านั้น
 * และจะไม่ส่งฟิลด์ rows เพื่อไม่ไปทับรายการงานบนสคริปต์รุ่นเก่า
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SaleAssign = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var STORE_KEY = 'pac-sale-assign-v1';
  var DIRTY_KEY = 'pac-sale-assign-dirty-v1';
  var KEY_STORE = 'pe-jobs-admin-key';
  var PE_API = 'https://script.google.com/macros/s/AKfycbyTLuAv5sGDRJINR_nhOGJs5yUAQT3hGKsOaDFbtwazyil6C2BFHb8SkxVFncDO6_Sm/exec';
  var remoteReady = null;
  var epoch = 0;

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

  function readJson(storage, key) {
    var box = storageOf(storage);
    if (!box) return {};
    try {
      var obj = JSON.parse(box.getItem(key) || '{}');
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
      return obj;
    } catch (e) {
      return {};
    }
  }

  function writeJson(storage, key, obj) {
    var box = storageOf(storage);
    if (!box) return;
    box.setItem(key, JSON.stringify(obj || {}));
  }

  function readStore(storage) { return readJson(storage, STORE_KEY); }
  function writeStore(obj, storage) { writeJson(storage, STORE_KEY, obj); }
  function readDirty(storage) { return readJson(storage, DIRTY_KEY); }
  function writeDirty(obj, storage) { writeJson(storage, DIRTY_KEY, obj); }

  function readAdminKey(storage) {
    var box = storageOf(storage);
    if (!box) return '';
    try { return String(box.getItem(KEY_STORE) || '').trim(); }
    catch (e) { return ''; }
  }

  function writeAdminKey(k, storage) {
    var box = storageOf(storage);
    if (!box) return;
    try {
      if (k) box.setItem(KEY_STORE, String(k).trim());
      else box.removeItem(KEY_STORE);
    } catch (e) {}
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

  function remember(company, hotel, baseSale, sale, nick, storage) {
    epoch++;
    var next = setAssignment(readStore(storage), company, hotel, baseSale, sale, nick);
    writeStore(next, storage);
    var dirty = readDirty(storage);
    var key = assignKey(company, hotel, baseSale);
    dirty[key] = (!norm(sale) || !norm(nick) || norm(sale) === norm(baseSale)) ? 'del' : 'set';
    writeDirty(dirty, storage);
    return next;
  }

  function rowsToStore(rows) {
    var store = {};
    (rows || []).forEach(function (r) {
      if (!r) return;
      var company = r.company != null ? r.company : r.c;
      var hotel = r.hotel;
      var baseSale = r.baseSale != null ? r.baseSale : r.base;
      var sale = r.sale;
      var nick = r.nick;
      if (!norm(sale) || !norm(nick) || norm(sale) === norm(baseSale)) return;
      store[assignKey(company, hotel, baseSale)] = { sale: norm(sale), nick: norm(nick) };
    });
    return store;
  }

  function adoptRemote(rows, storage) {
    var remote = rowsToStore(rows);
    var local = readStore(storage);
    var dirty = readDirty(storage);
    var next = {};
    Object.keys(remote).forEach(function (k) { next[k] = remote[k]; });
    Object.keys(dirty).forEach(function (k) {
      if (dirty[k] === 'del') delete next[k];
      else if (local[k]) next[k] = local[k];
    });
    writeStore(next, storage);
    return next;
  }

  function isSaleAssignPack(data) {
    return !!(data && data.ok === true && data.action === 'saleAssign' && Array.isArray(data.rows));
  }

  function saleAssignPayload(company, hotel, baseSale, sale, nick, adminKey) {
    return {
      action: 'saleAssign',
      key: String(adminKey || '').trim(),
      company: norm(company),
      hotel: norm(hotel),
      baseSale: norm(baseSale),
      sale: norm(sale),
      nick: norm(nick)
    };
  }

  function partsOf(key) {
    var p = String(key || '').split('\n');
    return { company: p[0] || '', hotel: p[1] || '', baseSale: p[2] || '' };
  }

  function getJson(url) {
    if (typeof fetch !== 'function') return Promise.reject(new Error('no-fetch'));
    var fetchP = fetch(url, { method: 'GET', redirect: 'follow', cache: 'no-store', credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('status'); return r.json(); });
    var jsonp = new Promise(function (resolve, reject) {
      if (typeof document === 'undefined') { reject(new Error('no-dom')); return; }
      var cb = 'saleAssign_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
      var s = document.createElement('script');
      var timer = setTimeout(function () { cleanup(); reject(new Error('timeout')); }, 20000);
      function cleanup() {
        clearTimeout(timer);
        try { delete root[cb]; } catch (e) { root[cb] = undefined; }
        if (s.parentNode) s.parentNode.removeChild(s);
      }
      root[cb] = function (data) { cleanup(); resolve(data); };
      s.onerror = function () { cleanup(); reject(new Error('jsonp')); };
      s.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'callback=' + encodeURIComponent(cb);
      document.head.appendChild(s);
    });
    return Promise.race([
      fetchP.catch(function () { return jsonp; }),
      new Promise(function (_, reject) { setTimeout(function () { reject(new Error('slow')); }, 12000); })
    ]).catch(function () { return jsonp; });
  }

  function postJson(payload) {
    if (typeof fetch !== 'function') return Promise.reject(new Error('no-fetch'));
    return fetch(PE_API, {
      method: 'POST',
      redirect: 'follow',
      credentials: 'omit',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (res) { return res.text(); }).then(function (text) {
      if (!text || String(text).trim().charAt(0) === '<') throw new Error('html');
      return JSON.parse(text);
    });
  }

  function promptAdminKey(again) {
    if (typeof prompt !== 'function') return '';
    var k = prompt(again
      ? 'รหัสไม่ถูกต้อง ใส่รหัสผู้ดูแลของ PE Jobs อีกครั้ง\nกดยกเลิกเพื่อเก็บแค่บนเครื่องนี้'
      : 'รหัสผู้ดูแลของ PE Jobs\nใช้รหัสเดียวกับตอนย้ายหมุดบนแผนที่\nกดยกเลิกเพื่อเก็บแค่บนเครื่องนี้');
    if (k == null) return '';
    var t = String(k).trim();
    if (t) writeAdminKey(t);
    return t;
  }

  function pushPayload(payload) {
    return postJson(payload).then(function (data) {
      if (data && data.action === 'saleAssign' && data.ok) return { ok: true, supported: true };
      if (data && data.action === 'saleAssign' && data.auth === false) {
        return { ok: false, supported: true, auth: false, error: data.error || '' };
      }
      if (!data || data.action !== 'saleAssign') return { ok: false, supported: false };
      return { ok: false, supported: true, error: data.error || '' };
    }).catch(function () {
      return { ok: false, supported: true, error: true };
    });
  }

  function clearDirtyIf(key, mode, storage) {
    var dirty = readDirty(storage);
    if (dirty[key] !== mode) return;
    delete dirty[key];
    writeDirty(dirty, storage);
  }

  function flushDirty(adminKey, storage) {
    if (!adminKey || remoteReady !== true) return Promise.resolve();
    var dirty = readDirty(storage);
    var store = readStore(storage);
    var keys = Object.keys(dirty);
    var chain = Promise.resolve();
    keys.forEach(function (key) {
      chain = chain.then(function () {
        var mode = dirty[key];
        var parts = partsOf(key);
        var hit = store[key];
        var sale = mode === 'del' || !hit ? parts.baseSale : hit.sale;
        var nick = mode === 'del' || !hit ? '-' : hit.nick;
        var payload = saleAssignPayload(parts.company, parts.hotel, parts.baseSale, sale, nick, adminKey);
        return pushPayload(payload).then(function (res) {
          if (res && res.ok) clearDirtyIf(key, mode, storage);
        });
      });
    });
    return chain;
  }

  function loadRemote(storage) {
    var seen = epoch;
    return getJson(PE_API + '?action=saleAssign').then(function (data) {
      if (!isSaleAssignPack(data)) {
        remoteReady = false;
        return { supported: false, applied: false };
      }
      remoteReady = true;
      if (seen !== epoch) return { supported: true, applied: false, stale: true };
      adoptRemote(data.rows, storage);
      var key = readAdminKey(storage);
      return flushDirty(key, storage).then(function () {
        return { supported: true, applied: true };
      });
    }).catch(function () {
      if (remoteReady == null) remoteReady = false;
      return { supported: false, applied: false };
    });
  }

  function publish(record, storage) {
    var payloadBase = {
      company: record.company,
      hotel: record.hotel,
      baseSale: record.baseSale,
      sale: record.sale,
      nick: record.nick
    };
    var keyName = assignKey(record.company, record.hotel, record.baseSale);
    var mode = (!norm(record.sale) || !norm(record.nick) || norm(record.sale) === norm(record.baseSale)) ? 'del' : 'set';
    function finish(res) {
      if (res && res.ok) clearDirtyIf(keyName, mode, storage);
      return res;
    }
    var ready = remoteReady === true
      ? Promise.resolve({ supported: true, applied: false })
      : loadRemote(storage);
    return ready.then(function (probe) {
      if (!probe || probe.supported !== true && remoteReady !== true) {
        return { supported: false, redraw: !!(probe && probe.applied) };
      }
      var adminKey = readAdminKey(storage);
      if (!adminKey) {
        adminKey = promptAdminKey(false);
        if (!adminKey) return { supported: true, needKey: true, localOnly: true, redraw: !!(probe && probe.applied) };
      }
      return pushPayload(saleAssignPayload(payloadBase.company, payloadBase.hotel, payloadBase.baseSale, payloadBase.sale, payloadBase.nick, adminKey))
        .then(function (res) {
          if (res && res.auth === false) {
            writeAdminKey('', storage);
            adminKey = promptAdminKey(true);
            if (!adminKey) return { supported: true, auth: false, localOnly: true, redraw: !!(probe && probe.applied) };
            return pushPayload(saleAssignPayload(payloadBase.company, payloadBase.hotel, payloadBase.baseSale, payloadBase.sale, payloadBase.nick, adminKey));
          }
          return res;
        })
        .then(function (res) {
          res.redraw = !!(probe && probe.applied);
          return finish(res);
        });
    });
  }

  function saveMessage(result, who, nick) {
    var head = who + ' ดูแลโดย ' + nick;
    if (result && result.ok) return 'บันทึกลงชีตแล้ว · ' + head + ' ทุกเครื่องจะเห็นหลังรีเฟรช';
    if (result && result.auth === false) return 'รหัสไม่ถูกต้อง บันทึกบนเครื่องนี้แล้ว แต่ยังไม่ลงชีต';
    if (result && (result.needKey || result.localOnly)) return 'บันทึกบนเครื่องนี้แล้ว · ' + head + ' ยังไม่ลงชีตเพราะไม่ได้ใส่รหัส';
    if (!result || result.supported === false) return 'บันทึกบนเครื่องนี้แล้ว · ' + head + ' ชีตยังไม่รับรายการนี้ จึงยังไม่ไปเครื่องอื่น';
    return 'บันทึกบนเครื่องนี้แล้ว · ' + head + ' แต่ยังส่งขึ้นชีตไม่สำเร็จ';
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
    DIRTY_KEY: DIRTY_KEY,
    KEY_STORE: KEY_STORE,
    norm: norm,
    assignKey: assignKey,
    readStore: readStore,
    writeStore: writeStore,
    readDirty: readDirty,
    lookup: lookup,
    setAssignment: setAssignment,
    remember: remember,
    rowsToStore: rowsToStore,
    adoptRemote: adoptRemote,
    isSaleAssignPack: isSaleAssignPack,
    saleAssignPayload: saleAssignPayload,
    loadRemote: loadRemote,
    publish: publish,
    saveMessage: saveMessage,
    readAdminKey: readAdminKey,
    writeAdminKey: writeAdminKey,
    workloadStats: workloadStats,
    sharedCustomerCount: sharedCustomerCount
  };
});
