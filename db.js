// ============================================================
//  db.js — Vellfire Holidays  |  Production-Safe Data Layer
//  Firebase v8 compat  |  No ES modules  |  Auth-aware
// ============================================================
//
//  ROOT CAUSES FIXED IN THIS VERSION
//  ──────────────────────────────────
//  1. AUTO-RESET BUG: vfGetAll() used to seed DEFAULT data
//     whenever the collection appeared empty — this happened
//     every time Firestore rules blocked the read (permission
//     error returns an empty-looking snapshot in some SDKs),
//     or when you opened a page before auth loaded.
//     FIX → seed is now a one-time admin-only function
//           (vfSeedIfEmpty) that is NEVER called automatically.
//
//  2. SET() OVERWRITE: vfSave() called .set(obj) for updates,
//     which silently erased fields not in the payload.
//     FIX → updates now use .update(fields) so only the fields
//           you touched are changed; _order/_ts are preserved.
//
//  3. DUPLICATE WRITES: every public page called vfGetAll()
//     which could trigger a batch.set() write, racing with
//     admin saves and resetting data.
//     FIX → public pages only read; writes are admin-only.
//
//  4. AUTH TIMING: firebase.auth() was never awaited, so
//     admin writes fired before the user token was ready,
//     causing intermittent permission denials.
//     FIX → all writes go through vfReady() which resolves
//           only after auth state is confirmed.
// ============================================================

// ── Init ─────────────────────────────────────────────────────
var FB_READY = (
  typeof firebaseConfig !== 'undefined' &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId.indexOf('PASTE') === -1
);

var db   = null;
var auth = null;

// Promise that resolves once Firebase Auth state is known
var _authReady = new Promise(function(resolve) {
  if (!FB_READY) { resolve(null); return; }
  try {
    // initializeApp is safe to call multiple times — catches duplicate
    try { firebase.initializeApp(firebaseConfig); } catch(e) {}
    db   = firebase.firestore();
    auth = firebase.auth();

    // Resolve as soon as auth state is determined (signed in or not)
    var unsub = auth.onAuthStateChanged(function(user) {
      unsub();          // unsubscribe after first event
      resolve(user);
      if (user) {
        console.log('%c[Vellfire] 🔥 Firebase LIVE | signed in as ' + user.email,
          'color:#20875a;font-weight:bold');
      } else {
        console.log('%c[Vellfire] 🔥 Firebase LIVE | public (read-only)',
          'color:#20875a');
      }
    });
  } catch(e) {
    console.error('[Vellfire] Firebase init error:', e.message);
    resolve(null);
  }
});

// ── Collections ───────────────────────────────────────────────
var C_TOURS    = 'tours';
var C_CARS     = 'cars';
var C_REVIEWS  = 'reviews';
var C_BOOKINGS = 'bookings';

// ── UID ───────────────────────────────────────────────────────
function vfUID() {
  return 'vf_' + Date.now() + '_' + Math.floor(Math.random() * 99999);
}

// ── localStorage helpers (fallback when Firebase not set up) ──
function lsGet(k, d) {
  try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }
  catch(e) { return d; }
}
function lsSet(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {}
}

// ── Default seed data (used ONLY by admin seed function) ──────
var DEFAULT_TOURS = [
  {id:'t1',title:'Gulmarg Tour',duration:'2 Days / 1 Night',price:3499,originalPrice:4500,
   category:'Adventure',image:'https://images.unsplash.com/photo-1551632811-561732d1e306?w=700&q=80',
   description:'Experience the world-famous ski resort and Gondola ride at Gulmarg — a winter wonderland and summer paradise.',
   inclusions:['Transport','Hotel','Breakfast','Gondola Ticket','Guide'],featured:true,_order:0},
  {id:'t2',title:'Pahalgam Tour',duration:'2 Days / 1 Night',price:3999,originalPrice:5000,
   category:'Nature',image:'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=700&q=80',
   description:'Explore the Valley of Shepherds — Lidder River, Baisaran meadows and pine forests of Pahalgam.',
   inclusions:['Transport','Hotel','Meals','Baisaran Visit','Guide'],featured:true,_order:1},
  {id:'t3',title:'Sonamarg Tour',duration:'1 Day / Day Trip',price:2499,originalPrice:3200,
   category:'Adventure',image:'https://images.unsplash.com/photo-1578894381163-e72c17f2d45f?w=700&q=80',
   description:'The Meadow of Gold — glaciers, snow bridges and the iconic Thajiwas glacier pony ride.',
   inclusions:['Transport','Lunch','Glacier Visit','Guide'],featured:true,_order:2},
  {id:'t4',title:'Full Kashmir Package',duration:'7 Days / 6 Nights',price:18999,originalPrice:24000,
   category:'Complete',image:'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=700&q=80',
   description:'Complete Kashmir experience — Dal Lake, Gulmarg, Pahalgam, Sonamarg, Mughal Gardens & more.',
   inclusions:['Houseboat Stay','Hotels','All Meals','All Sightseeing','Airport Transfers','Dedicated Guide'],
   featured:true,_order:3}
];
var DEFAULT_CARS = [
  {id:'c1',name:'Innova',seats:'7 Seater',price:'₹2,500/day',
   image:'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=700&q=80',
   description:'Comfortable and spacious Toyota Innova — ideal for family trips and mountain tours.',
   features:['AC','7 Seats','Music System','Experienced Driver'],_order:0},
  {id:'c2',name:'Innova Crysta',seats:'7 Seater',price:'₹3,200/day',
   image:'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=700&q=80',
   description:'Premium Toyota Innova Crysta with superior comfort for a luxurious Kashmir travel experience.',
   features:['AC','7 Seats','Premium Interior','Sunshade','Expert Driver'],_order:1},
  {id:'c3',name:'Tempo Traveller',seats:'12 Seater',price:'₹4,800/day',
   image:'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=700&q=80',
   description:'Perfect for group tours — spacious Tempo Traveller with push-back seats and ample luggage space.',
   features:['AC','12 Seats','Push-back Seats','Luggage Space','Driver'],_order:2},
  {id:'c4',name:'Sedan',seats:'4 Seater',price:'₹1,800/day',
   image:'https://images.unsplash.com/photo-1550355291-bbee04a92027?w=700&q=80',
   description:'Budget-friendly sedan for couples and solo travelers — clean, comfortable and reliable.',
   features:['AC','4 Seats','Music System','Driver'],_order:3}
];
var DEFAULT_REVIEWS = [
  {id:'r1',name:'Aditya Verma',location:'New Delhi',rating:5,
   text:'Vellfire Holidays gave us the best Kashmir experience! Shaiq bhai arranged everything perfectly — houseboat, Gulmarg, Pahalgam. Will recommend to all!',_order:0},
  {id:'r2',name:'Priya & Rohit',location:'Mumbai',rating:5,
   text:'Booked the Full Kashmir Package for our honeymoon. The Innova Crysta was spotless and our guide was incredibly knowledgeable. Thank you Vellfire!',_order:1},
  {id:'r3',name:'Sharma Family',location:'Bangalore',rating:5,
   text:'Traveled with family of 6 in the Tempo Traveller. Kids loved the snow in Gulmarg and Sonamarg. Excellent service throughout the trip!',_order:2}
];

// ═══════════════════════════════════════════════════════════════
//  READ FUNCTIONS  (public — no auth required)
// ═══════════════════════════════════════════════════════════════

// vfGetAll — READ ONLY.  Never writes anything to Firestore.
// Falls back to localStorage defaults if Firebase not configured
// or if Firestore returns an error/empty collection.
function vfGetAll(col, lsKey, def) {
  if (!db) return Promise.resolve(lsGet(lsKey, def));

  return db.collection(col).orderBy('_order', 'asc').get()
    .then(function(snap) {
      if (snap.empty) {
        // Collection genuinely empty — return localStorage or defaults.
        // DO NOT auto-seed. Admin must seed manually via vfSeedIfEmpty().
        var cached = lsGet(lsKey, null);
        return cached && cached.length ? cached : def;
      }
      var docs = snap.docs.map(function(d) { return d.data(); });
      // Cache in localStorage so public pages work offline / on slow connections
      lsSet(lsKey, docs);
      return docs;
    })
    .catch(function(e) {
      console.warn('[Vellfire] Firestore read error, using cache:', e.message);
      return lsGet(lsKey, def);
    });
}

function vfGetTours()    { return vfGetAll(C_TOURS,   'vf_tours',   DEFAULT_TOURS);   }
function vfGetCars()     { return vfGetAll(C_CARS,    'vf_cars',    DEFAULT_CARS);    }
function vfGetReviews()  { return vfGetAll(C_REVIEWS, 'vf_reviews', DEFAULT_REVIEWS); }
function vfGetBookings() {
  if (!db) return Promise.resolve(lsGet('vf_bookings', []));
  return db.collection(C_BOOKINGS).orderBy('_ts', 'desc').get()
    .then(function(snap) { return snap.docs.map(function(d) { return d.data(); }); })
    .catch(function()   { return lsGet('vf_bookings', []); });
}

// ═══════════════════════════════════════════════════════════════
//  WRITE FUNCTIONS  (admin only — require auth)
// ═══════════════════════════════════════════════════════════════

// vfReady — waits for auth state before any write
function vfReady() {
  return _authReady.then(function(user) {
    if (!db) return Promise.reject(new Error('Firebase not configured'));
    if (!user) return Promise.reject(new Error('Not authenticated — please log in'));
    return user;
  });
}

// vfSave — safe add / update
//   isNew=true  → creates document with .set() (full document, safe for new)
//   isNew=false → updates ONLY the provided fields with .update() (never erases others)
function vfSave(col, lsKey, obj, isNew) {
  var id = obj.id || vfUID();
  obj.id = id;
  obj._ts = Date.now();

  // ── localStorage path (Firebase not configured) ──
  if (!db) {
    var arr = lsGet(lsKey, []);
    var idx = arr.findIndex(function(x) { return x.id === id; });
    if (idx > -1) {
      // Merge — don't replace the whole object
      arr[idx] = Object.assign({}, arr[idx], obj);
    } else {
      obj._order = arr.length;
      arr.push(obj);
    }
    lsSet(lsKey, arr);
    return Promise.resolve(obj);
  }

  // ── Firestore path ──
  return vfReady().then(function() {
    var ref = db.collection(col).doc(id);

    if (isNew) {
      // New document: count existing docs to set correct _order
      return db.collection(col).get()
        .then(function(snap) {
          obj._order = snap.size;
          // .set() is correct for NEW documents — creates full record
          return ref.set(obj);
        })
        .then(function() {
          // Update local cache
          var cached = lsGet(lsKey, []);
          cached.push(obj);
          lsSet(lsKey, cached);
          return obj;
        });
    } else {
      // Existing document: use .update() so unspecified fields are preserved
      // Strip undefined values (Firestore rejects them)
      var updatePayload = {};
      Object.keys(obj).forEach(function(k) {
        if (obj[k] !== undefined) updatePayload[k] = obj[k];
      });

      return ref.update(updatePayload)
        .then(function() {
          // Update local cache entry
          var cached = lsGet(lsKey, []);
          var ci = cached.findIndex(function(x) { return x.id === id; });
          if (ci > -1) {
            cached[ci] = Object.assign({}, cached[ci], updatePayload);
          }
          lsSet(lsKey, cached);
          return Object.assign({}, updatePayload);
        });
    }
  });
}

// Booking write — no auth required (public form submission)
// Uses .set() because it is always a NEW document
function vfSaveBooking(obj) {
  obj.id   = vfUID();
  obj._ts  = Date.now();
  obj.date_submitted = new Date().toLocaleDateString('en-IN', {
    day:'2-digit', month:'short', year:'numeric'
  });

  if (!db) {
    var arr = lsGet('vf_bookings', []);
    arr.push(obj);
    lsSet('vf_bookings', arr);
    return Promise.resolve(obj);
  }

  // Bookings are always new — .set() is correct here
  return db.collection(C_BOOKINGS).doc(obj.id).set(obj)
    .then(function() { return obj; })
    .catch(function(e) {
      console.warn('[Vellfire] Booking save error:', e.message);
      // Fallback: save locally so enquiry is not lost
      var arr = lsGet('vf_bookings', []);
      arr.push(obj);
      lsSet('vf_bookings', arr);
      return obj;
    });
}

// ── Public save wrappers ──────────────────────────────────────
function vfSaveTour(obj, isNew)   { return vfSave(C_TOURS,   'vf_tours',   obj, isNew); }
function vfSaveCar(obj, isNew)    { return vfSave(C_CARS,    'vf_cars',    obj, isNew); }
function vfSaveReview(obj, isNew) { return vfSave(C_REVIEWS, 'vf_reviews', obj, isNew); }

// ── Delete wrappers ───────────────────────────────────────────
function vfDelete(col, lsKey, id) {
  if (!db) {
    lsSet(lsKey, lsGet(lsKey, []).filter(function(x) { return x.id !== id; }));
    return Promise.resolve();
  }
  return vfReady().then(function() {
    return db.collection(col).doc(id).delete()
      .then(function() {
        // Remove from local cache too
        lsSet(lsKey, lsGet(lsKey, []).filter(function(x) { return x.id !== id; }));
      });
  });
}

function vfDeleteTour(id)    { return vfDelete(C_TOURS,    'vf_tours',    id); }
function vfDeleteCar(id)     { return vfDelete(C_CARS,     'vf_cars',     id); }
function vfDeleteReview(id)  { return vfDelete(C_REVIEWS,  'vf_reviews',  id); }
function vfDeleteBooking(id) { return vfDelete(C_BOOKINGS, 'vf_bookings', id); }

// ── Admin: sign in / out ──────────────────────────────────────
function vfAdminLogin(email, password) {
  if (!auth) return Promise.reject(new Error('Firebase not configured'));
  return auth.signInWithEmailAndPassword(email, password);
}

function vfAdminLogout() {
  if (!auth) return Promise.resolve();
  return auth.signOut();
}

function vfCurrentUser() {
  return auth ? auth.currentUser : null;
}

// ── Admin: one-time seed (call manually from admin panel if needed) ──
// Seeds DEFAULT data ONLY if the collection is genuinely empty.
// Safe: checks before writing, never overwrites existing docs.
function vfSeedIfEmpty(col, def) {
  return vfReady().then(function() {
    return db.collection(col).limit(1).get();
  }).then(function(snap) {
    if (!snap.empty) {
      console.log('[Vellfire] Seed skipped — ' + col + ' already has data');
      return;
    }
    var batch = db.batch();
    def.forEach(function(item, i) {
      var d = Object.assign({}, item, { _order: i, _ts: Date.now() });
      batch.set(db.collection(col).doc(item.id), d);
    });
    return batch.commit().then(function() {
      console.log('[Vellfire] Seeded ' + def.length + ' docs into ' + col);
    });
  });
}
