import fs from 'fs';
import path from 'path';

const publicDir = './public';

function inspect() {
  console.log('--- Inspecting Wards in wards.json ---');
  if (fs.existsSync(path.join(publicDir, 'wards.json'))) {
    const wards = JSON.parse(fs.readFileSync(path.join(publicDir, 'wards.json'), 'utf8'));
    const w302 = wards.find(w => w.WARD_NO === 302);
    const w303 = wards.find(w => w.WARD_NO === 303);

    console.log('Ward 302:', w302 ? {
      WARD_NO: w302.WARD_NO,
      NAME: w302.NAME,
      CIRCLE_NO: w302.CIRCLE_NO,
      CIR_NAM_NU: w302.CIR_NAM_NU,
      Zone_Name: w302.Zone_Name,
      AC_Name: w302.AC_Name,
      CORPORATE: w302.CORPORATE,
      circle: w302.circle
    } : 'Not found');

    console.log('Ward 303:', w303 ? {
      WARD_NO: w303.WARD_NO,
      NAME: w303.NAME,
      CIRCLE_NO: w303.CIRCLE_NO,
      CIR_NAM_NU: w303.CIR_NAM_NU,
      Zone_Name: w303.Zone_Name,
      AC_Name: w303.AC_Name,
      CORPORATE: w303.CORPORATE,
      circle: w303.circle
    } : 'Not found');
  }

  console.log('\n--- Inspecting mapping.json ---');
  if (fs.existsSync(path.join(publicDir, 'mapping.json'))) {
    const mapping = JSON.parse(fs.readFileSync(path.join(publicDir, 'mapping.json'), 'utf8'));
    console.log('mapping["302"]:', mapping['302']);
    console.log('mapping["303"]:', mapping['303']);
  }

  console.log('\n--- Inspecting division_mapping.json ---');
  if (fs.existsSync(path.join(publicDir, 'division_mapping.json'))) {
    const divMapping = JSON.parse(fs.readFileSync(path.join(publicDir, 'division_mapping.json'), 'utf8'));
    console.log('Ameenpur:', divMapping['Ameenpur']);
    console.log('Bowenpally:', divMapping['Bowenpally']);
  }

  console.log('\n--- Inspecting circles.json ---');
  if (fs.existsSync(path.join(publicDir, 'circles.json'))) {
    const circles = JSON.parse(fs.readFileSync(path.join(publicDir, 'circles.json'), 'utf8'));
    const c6 = circles.find(c => c.CIRCLE_NO === 6 || c.name === 'Bowenpally');
    const c58 = circles.find(c => c.CIRCLE_NO === 58 || c.name === 'Ameenpur');
    console.log('Circle 6 (Bowenpally):', c6 ? {
      CIRCLE_NO: c6.CIRCLE_NO,
      CIR_NAM_NU: c6.CIR_NAM_NU,
      name: c6.name,
      division_name: c6.division_name,
      ward_numbers: c6.ward_numbers,
      ward_names: c6.ward_names
    } : 'Not found');
    console.log('Circle 58 (Ameenpur):', c58 ? {
      CIRCLE_NO: c58.CIRCLE_NO,
      CIR_NAM_NU: c58.CIR_NAM_NU,
      name: c58.name,
      division_name: c58.division_name,
      ward_numbers: c58.ward_numbers,
      ward_names: c58.ward_names
    } : 'Not found');
  }

  console.log('\n--- Inspecting divisions.json ---');
  if (fs.existsSync(path.join(publicDir, 'divisions.json'))) {
    const divisions = JSON.parse(fs.readFileSync(path.join(publicDir, 'divisions.json'), 'utf8'));
    const malkajgiri = divisions.find(d => d.name === 'Malkajgiri');
    const serilingampally = divisions.find(d => d.name === 'Serilingampally');
    console.log('Division Malkajgiri:', malkajgiri ? {
      name: malkajgiri.name,
      circle_names: malkajgiri.circle_names
    } : 'Not found');
    console.log('Division Serilingampally:', serilingampally ? {
      name: serilingampally.name,
      circle_names: serilingampally.circle_names
    } : 'Not found');
  }
}

inspect();
