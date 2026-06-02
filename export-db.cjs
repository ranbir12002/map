/**
 * Export script: Pulls wards, circles, and divisions from the stateGst MongoDB
 * and saves them as JSON files in public/ for the static Vite site to use.
 *
 * Usage: node export-db.js
 */

const mongoose = require('mongoose');

// ─── Connection ───────────────────────────────────────────────
const MONGO_URI = 'mongodb+srv://ranbir12002:gg@cluster0.jjvmywl.mongodb.net/stateGst';

// ─── Schemas (inline, matching stateGst backend models) ──────
const WardSchema = new mongoose.Schema({
  WARD_NO: Number,
  NAME: String,
  CIRCLE_NO: Number,
  CIR_NAM_NU: String,
  Zone_Name: String,
  AC_Name: String,
  CORPORATE: String,
  Area__Sqkm: Number,
  circle: { type: mongoose.Schema.Types.ObjectId, ref: 'Circle' },
  geometry: {
    type: { type: String },
    coordinates: mongoose.Schema.Types.Mixed
  },
  business_count: Number,
  status: String
}, { timestamps: true });

const CircleSchema = new mongoose.Schema({
  CIRCLE_NO: Number,
  CIR_NAM_NU: String,
  name: String,
  Zone_Name: String,
  CORPORATE: String,
  division: { type: mongoose.Schema.Types.ObjectId, ref: 'Division' },
  division_name: String,
  wards: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ward' }],
  ward_count: Number,
  ward_numbers: [Number],
  ward_names: [String],
  business_count: Number,
  status: String
}, { timestamps: true });

const DivisionSchema = new mongoose.Schema({
  name: String,
  circles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Circle' }],
  circle_names: [String]
}, { timestamps: true });

const Ward = mongoose.model('Ward', WardSchema);
const Circle = mongoose.model('Circle', CircleSchema);
const Division = mongoose.model('Division', DivisionSchema);

// ─── Main Export ──────────────────────────────────────────────
async function main() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected!\n');

  // 1. Fetch wards with circle populated
  console.log('📦 Fetching wards...');
  const wards = await Ward.find({})
    .sort({ WARD_NO: 1 })
    .populate('circle', 'CIR_NAM_NU CIRCLE_NO name division_name')
    .lean();
  console.log(`   Found ${wards.length} wards`);

  // 2. Fetch circles
  console.log('📦 Fetching circles...');
  const circles = await Circle.find({})
    .sort({ CIRCLE_NO: 1 })
    .lean();
  console.log(`   Found ${circles.length} circles`);

  // 3. Fetch divisions
  console.log('📦 Fetching divisions...');
  const divisions = await Division.find({})
    .sort({ name: 1 })
    .lean();
  console.log(`   Found ${divisions.length} divisions`);

  // 4. Write to public/ folder
  const fs = require('fs');
  const path = require('path');
  const publicDir = path.join(__dirname, 'public');

  // Ensure public dir exists
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const wardsPath = path.join(publicDir, 'wards.json');
  const circlesPath = path.join(publicDir, 'circles.json');
  const divisionsPath = path.join(publicDir, 'divisions.json');

  fs.writeFileSync(wardsPath, JSON.stringify(wards, null, 2));
  console.log(`\n✅ Wrote ${wards.length} wards → public/wards.json (${(fs.statSync(wardsPath).size / 1024 / 1024).toFixed(2)} MB)`);

  fs.writeFileSync(circlesPath, JSON.stringify(circles, null, 2));
  console.log(`✅ Wrote ${circles.length} circles → public/circles.json (${(fs.statSync(circlesPath).size / 1024 / 1024).toFixed(2)} MB)`);

  fs.writeFileSync(divisionsPath, JSON.stringify(divisions, null, 2));
  console.log(`✅ Wrote ${divisions.length} divisions → public/divisions.json (${(fs.statSync(divisionsPath).size / 1024 / 1024).toFixed(2)} MB)`);

  console.log('\n🎉 Done! JSON files are ready in public/');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
