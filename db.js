// ============================================================
//  db.js — Vellfire Holidays Firestore Layer (Firebase v8 compat)
//  No ES modules — works on file:// and any static host
// ============================================================

var FB_READY = (
  typeof firebaseConfig !== 'undefined' &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId.indexOf('PASTE') === -1
);

var db = null;
if (FB_READY) {
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log('%c[Vellfire] 🔥 Firebase LIVE → ' + firebaseConfig.projectId, 'color:#20875a;font-weight:bold');
  } catch(e) {
    try { db = firebase.firestore(); } catch(e2) {}
  }
} else {
  console.warn('[Vellfire] 💾 localStorage fallback — configure firebase-config.js');
}

// ── Collections ──────────────────────────────────────────────
var C_TOURS = 'tours';
var C_CARS  = 'cars';
var C_REVIEWS = 'reviews';
var C_BOOKINGS = 'bookings';

// ── UID ──────────────────────────────────────────────────────
function vfUID() { return 'vf_' + Date.now() + '_' + Math.floor(Math.random()*99999); }

// ── localStorage helpers ──────────────────────────────────────
function lsGet(k,d){ try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;} }
function lsSet(k,v){ try{localStorage.setItem(k,JSON.stringify(v));}catch(e){} }

// ── Default Data ──────────────────────────────────────────────
var DEFAULT_TOURS = [
  {id:'t1',title:'Gulmarg Tour',duration:'2 Days / 1 Night',price:3499,originalPrice:4500,category:'Adventure',image:'https://images.unsplash.com/photo-1551632811-561732d1e306?w=700&q=80',description:'Experience the world-famous ski resort and Gondola ride at Gulmarg — a winter wonderland and summer paradise.',inclusions:['Transport','Hotel','Breakfast','Gondola Ticket','Guide'],featured:true,_order:0},
  {id:'t2',title:'Pahalgam Tour',duration:'2 Days / 1 Night',price:3999,originalPrice:5000,category:'Nature',image:'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=700&q=80',description:'Explore the Valley of Shepherds — Lidder River, Baisaran meadows and pine forests of Pahalgam.',inclusions:['Transport','Hotel','Meals','Baisaran Visit','Guide'],featured:true,_order:1},
  {id:'t3',title:'Sonamarg Tour',duration:'1 Day / Day Trip',price:2499,originalPrice:3200,category:'Adventure',image:'https://images.unsplash.com/photo-1578894381163-e72c17f2d45f?w=700&q=80',description:'The Meadow of Gold — glaciers, snow bridges and the iconic Thajiwas glacier pony ride.',inclusions:['Transport','Lunch','Glacier Visit','Guide'],featured:true,_order:2},
  {id:'t4',title:'Full Kashmir Package',duration:'7 Days / 6 Nights',price:18999,originalPrice:24000,category:'Complete',image:'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=700&q=80',description:'Complete Kashmir experience — Dal Lake, Gulmarg, Pahalgam, Sonamarg, Mughal Gardens & more.',inclusions:['Houseboat Stay','Hotels','All Meals','All Sightseeing','Airport Transfers','Dedicated Guide'],featured:true,_order:3}
];

var DEFAULT_CARS = [
  {id:'c1',name:'Innova',seats:'7 Seater',price:'₹2,500/day',image:'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=700&q=80',description:'Comfortable and spacious Toyota Innova — ideal for family trips and mountain tours.',features:['AC','7 Seats','Music System','Experienced Driver'],_order:0},
  {id:'c2',name:'Innova Crysta',seats:'7 Seater',price:'₹3,200/day',image:'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=700&q=80',description:'Premium Toyota Innova Crysta with superior comfort for a luxurious Kashmir travel experience.',features:['AC','7 Seats','Premium Interior','Sunshade','Expert Driver'],_order:1},
  {id:'c3',name:'Tempo Traveller',seats:'12 Seater',price:'₹4,800/day',image:'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=700&q=80',description:'Perfect for group tours — spacious Tempo Traveller with push-back seats and ample luggage space.',features:['AC','12 Seats','Push-back Seats','Luggage Space','Driver'],_order:2},
  {id:'c4',name:'Sedan',seats:'4 Seater',price:'₹1,800/day',image:'https://images.unsplash.com/photo-1550355291-bbee04a92027?w=700&q=80',description:'Budget-friendly sedan for couples and solo travelers — clean, comfortable and reliable.',features:['AC','4 Seats','Music System','Driver'],_order:3}
];

var DEFAULT_REVIEWS = [
  {id:'r1',name:'Aditya Verma',location:'New Delhi',rating:5,text:'Vellfire Holidays gave us the best Kashmir experience! Shaiq bhai arranged everything perfectly — houseboat, Gulmarg, Pahalgam. Will recommend to all!',_order:0},
  {id:'r2',name:'Priya & Rohit',location:'Mumbai',rating:5,text:'Booked the Full Kashmir Package for our honeymoon. The Innova Crysta was spotless and our guide was incredibly knowledgeable. Thank you Vellfire!',_order:1},
  {id:'r3',name:'Sharma Family',location:'Bangalore',rating:5,text:'Traveled with family of 6 in the Tempo Traveller. Kids loved the snow in Gulmarg and Sonamarg. Excellent service throughout the trip!',_order:2}
];

// ── Generic CRUD ──────────────────────────────────────────────
function vfGetAll(col, lsKey, def) {
  if (!db) return Promise.resolve(lsGet(lsKey, def));
  return db.collection(col).orderBy('_order','asc').get()
    .then(function(snap) {
      if (snap.empty) {
        var batch = db.batch();
        def.forEach(function(item, i) {
          var d = Object.assign({}, item, {_order:i, _ts:Date.now()});
          batch.set(db.collection(col).doc(item.id), d);
        });
        return batch.commit().then(function(){return def;});
      }
      return snap.docs.map(function(d){return d.data();});
    })
    .catch(function(e){
      console.warn('[Vellfire] Firestore error, using localStorage:', e.message);
      return lsGet(lsKey, def);
    });
}

function vfSave(col, lsKey, obj, isNew) {
  var id = obj.id || vfUID();
  obj.id = id; obj._ts = Date.now();
  if (!db) {
    var arr = lsGet(lsKey, []);
    var idx = arr.findIndex(function(x){return x.id===id;});
    if(idx>-1){arr[idx]=obj;}else{obj._order=arr.length;arr.push(obj);}
    lsSet(lsKey, arr);
    return Promise.resolve(obj);
  }
  if (isNew) {
    return db.collection(col).get().then(function(snap){
      obj._order = snap.size;
      return db.collection(col).doc(id).set(obj);
    }).then(function(){return obj;});
  }
  return db.collection(col).doc(id).set(obj,{merge:true}).then(function(){return obj;});
}

function vfDelete(col, lsKey, id) {
  if (!db) {
    lsSet(lsKey, lsGet(lsKey,[]).filter(function(x){return x.id!==id;}));
    return Promise.resolve();
  }
  return db.collection(col).doc(id).delete();
}

// ── Public API ────────────────────────────────────────────────
function vfGetTours()   { return vfGetAll(C_TOURS, 'vf_tours', DEFAULT_TOURS); }
function vfGetCars()    { return vfGetAll(C_CARS,  'vf_cars',  DEFAULT_CARS);  }
function vfGetReviews() { return vfGetAll(C_REVIEWS,'vf_reviews',DEFAULT_REVIEWS); }

function vfSaveTour(obj, isNew)   { return vfSave(C_TOURS, 'vf_tours', obj, isNew); }
function vfSaveCar(obj, isNew)    { return vfSave(C_CARS, 'vf_cars', obj, isNew); }
function vfSaveReview(obj, isNew) { return vfSave(C_REVIEWS,'vf_reviews',obj,isNew); }

function vfDeleteTour(id)   { return vfDelete(C_TOURS,'vf_tours',id); }
function vfDeleteCar(id)    { return vfDelete(C_CARS,'vf_cars',id); }
function vfDeleteReview(id) { return vfDelete(C_REVIEWS,'vf_reviews',id); }

function vfSaveBooking(obj) {
  obj.id = vfUID(); obj._ts = Date.now();
  obj.date_submitted = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
  if (!db) {
    var arr = lsGet('vf_bookings',[]); arr.push(obj); lsSet('vf_bookings',arr);
    return Promise.resolve(obj);
  }
  return db.collection(C_BOOKINGS).doc(obj.id).set(obj).then(function(){return obj;});
}
function vfGetBookings() {
  if (!db) return Promise.resolve(lsGet('vf_bookings',[]));
  return db.collection(C_BOOKINGS).orderBy('_ts','desc').get()
    .then(function(snap){return snap.docs.map(function(d){return d.data();});})
    .catch(function(){return lsGet('vf_bookings',[]);});
}
function vfDeleteBooking(id) { return vfDelete(C_BOOKINGS,'vf_bookings',id); }
