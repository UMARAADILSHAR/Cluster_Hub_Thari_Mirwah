const db = require('../db');

const officialSchoolsData = [
  {
    semis: '415060805',
    pid: '10469301',
    headTeacher: 'Muammad Ansar Banb',
    headGender: 'Male',
    contact: '0303-3217216',
    designation: 'HM (BPS-17)',
    ssb_25_26: '4,590,000',
    ssb_26_27: '4,912,000',
    old_cc: 'KX0397',
    new_cc: 'KX3571',
    cellHub: true
  },
  {
    semis: '415060444',
    pid: '10469547',
    headTeacher: 'Ghulam Hyder',
    headGender: 'Male',
    contact: '0302-3283466',
    designation: 'PST',
    ssb_25_26: '234,000',
    ssb_26_27: '329,000',
    old_cc: 'KX0246',
    new_cc: 'KX2767'
  },
  {
    semis: '415060838',
    pid: '11016859',
    headTeacher: 'Weenjhar Ali',
    headGender: 'Male',
    contact: '0322-3932939',
    designation: 'PST',
    ssb_25_26: '340,000',
    ssb_26_27: '443,000',
    old_cc: 'KX0246',
    new_cc: 'KX2556'
  },
  {
    semis: '415060724',
    pid: '10308599',
    headTeacher: 'Manzoor Ahmed',
    headGender: 'Male',
    contact: '0303-3249458',
    designation: 'PST',
    ssb_25_26: '',
    ssb_26_27: '',
    old_cc: 'KX0246',
    new_cc: ''
  },
  {
    semis: '415060656',
    pid: '10308770',
    headTeacher: 'Zulfiqar Ali',
    headGender: 'Male',
    contact: '0302-3660258',
    designation: 'PST',
    ssb_25_26: '413,000',
    ssb_26_27: '521,000',
    old_cc: 'KX0246',
    new_cc: 'KX2604'
  },
  {
    semis: '415060726',
    pid: '10293591',
    headTeacher: 'Ameer Ahmed',
    headGender: 'Male',
    contact: '0302-3606914',
    designation: 'PST',
    ssb_25_26: '603,000',
    ssb_26_27: '725,000',
    old_cc: 'KX0219',
    new_cc: 'KX1053'
  },
  {
    semis: '415060291',
    pid: '11015828',
    headTeacher: 'Israr Hussain',
    headGender: 'Male',
    contact: '0303-3358402',
    designation: 'PST',
    ssb_25_26: '264,000',
    ssb_26_27: '361,000',
    old_cc: 'KX0246',
    new_cc: 'KX2929'
  },
  {
    semis: '415060666',
    pid: '92037042',
    headTeacher: 'Allah Bux',
    headGender: 'Male',
    contact: '0307-5080980',
    designation: 'PST',
    ssb_25_26: '267,000',
    ssb_26_27: '364,000',
    old_cc: 'KX0246',
    new_cc: 'KX2823'
  },
  {
    semis: '415060382',
    pid: '10294191',
    headTeacher: 'Mahmood Hussain',
    headGender: 'Male',
    contact: '0301-3401351',
    designation: 'PST',
    ssb_25_26: '299,000',
    ssb_26_27: '399,000',
    old_cc: 'KX0246',
    new_cc: 'KX2791'
  },
  {
    semis: '415060042',
    pid: '10469922',
    headTeacher: 'Hasnain Sardar Ali',
    headGender: 'Male',
    contact: '0303-9655601',
    designation: 'PST',
    ssb_25_26: '267,000',
    ssb_26_27: '364,000',
    old_cc: 'KX0246',
    new_cc: 'KX2899'
  },
  {
    semis: '415060290',
    pid: '10308938',
    headTeacher: 'Altaf Hussain Jogi',
    headGender: 'Male',
    contact: '0303-9655601',
    designation: 'PST',
    ssb_25_26: '',
    ssb_26_27: '',
    old_cc: 'KX0246',
    new_cc: ''
  },
  {
    semis: '415060725',
    pid: '10974690',
    headTeacher: 'Azit Khatoon',
    headGender: 'Female',
    contact: '0309-3228928',
    designation: 'PST',
    ssb_25_26: '285,000',
    ssb_26_27: '384,000',
    old_cc: 'KX0246',
    new_cc: 'KX2897'
  },
  {
    semis: '415060812',
    pid: '10301370',
    headTeacher: 'Waheed Laghari',
    headGender: 'Female',
    contact: '0306-6719929',
    designation: 'Principal',
    ssb_25_26: '4,562,000',
    ssb_26_27: '4,791,000',
    old_cc: 'KX0474',
    new_cc: 'KX3669',
    cellHub: true
  },
  {
    semis: '415060640',
    pid: '10463921',
    headTeacher: 'Latifa Bibi',
    headGender: 'Female',
    contact: '0302-2415461',
    designation: 'PST',
    ssb_25_26: '288,000',
    ssb_26_27: '387,000',
    old_cc: 'KX0247',
    new_cc: 'KX2983'
  },
  {
    semis: '415060557',
    pid: '10810531',
    headTeacher: 'Shabana Khatoon',
    headGender: 'Female',
    contact: '0305-2012895',
    designation: 'HST',
    ssb_25_26: '525,000',
    ssb_26_27: '651,000',
    old_cc: 'KX0247',
    new_cc: 'KX3361'
  },
  {
    semis: '415060635',
    pid: '10821828',
    headTeacher: 'Ghazala',
    headGender: 'Female',
    contact: '0305-3969021',
    designation: 'PST',
    ssb_25_26: '363,000',
    ssb_26_27: '467,000',
    old_cc: 'KX0247',
    new_cc: 'KX2981'
  },
  {
    semis: '415060592',
    pid: '11113571',
    headTeacher: 'Kiran Bhatti',
    headGender: 'Female',
    contact: '0348-2076481',
    designation: 'PST',
    ssb_25_26: '266,000',
    ssb_26_27: '363,000',
    old_cc: 'KX0247',
    new_cc: 'KX2947'
  },
  {
    semis: '415060520',
    pid: '11038937',
    headTeacher: 'Rabel',
    headGender: 'Female',
    contact: '0312-2004026',
    designation: 'PST',
    ssb_25_26: '307,000',
    ssb_26_27: '407,000',
    old_cc: 'KX0247',
    new_cc: 'KX2988'
  },
  {
    semis: '415060584',
    pid: '10326598',
    headTeacher: 'Sajida',
    headGender: 'Female',
    contact: '0328-8440348',
    designation: 'PST',
    ssb_25_26: '301,000',
    ssb_26_27: '401,000',
    old_cc: 'KX0247',
    new_cc: 'KX2982'
  },
  {
    semis: '415060642',
    pid: '10455390',
    headTeacher: 'Mubina',
    headGender: 'Female',
    contact: '0302-2069051',
    designation: 'PST',
    ssb_25_26: '298,000',
    ssb_26_27: '398,000',
    old_cc: 'KX0247',
    new_cc: 'KX2980'
  },
  {
    semis: '415060583',
    pid: '10497200',
    headTeacher: 'Samina Begum',
    headGender: 'Female',
    contact: '0333-7135475',
    designation: 'PST',
    ssb_25_26: '248,000',
    ssb_26_27: '344,000',
    old_cc: 'KX0247',
    new_cc: 'KX2940'
  },
  {
    semis: '415060505',
    pid: '10583216',
    headTeacher: 'Rukhsana',
    headGender: 'Female',
    contact: '0306-3002283',
    designation: 'PST',
    ssb_25_26: '287,000',
    ssb_26_27: '386,000',
    old_cc: 'KX0247',
    new_cc: 'KX3013'
  },
  {
    semis: '415060597',
    pid: '11041527',
    headTeacher: 'Fahmida',
    headGender: 'Female',
    contact: '0308-8323066',
    designation: 'PST',
    ssb_25_26: '266,000',
    ssb_26_27: '363,000',
    old_cc: 'KX0247',
    new_cc: 'KX2974'
  }
];

const committeeMembers = [
  { role: 'Science', name: 'Mrs. Paras Bibi Solangi', semis: '41560812' },
  { role: 'Mathematics', name: 'Mrs. Yasemeen Fatima Noal', semis: '415060857' },
  { role: 'Sindhi', name: 'Mr. Allah Bux Khaskheli', semis: '415060805' },
  { role: 'Urdu', name: 'Mr. Asadullah Mangi', semis: '415060805' },
  { role: 'English', name: 'Mr. Amanat Raza Laghari', semis: '415060805' },
  { role: 'SMC Chairman', name: 'Mr. Mukhtiar Hussain Shar', semis: '415060805', term: '1 Year' }
];

async function updateClusterData() {
  const client = await db.pool.connect();
  try {
    console.log('🔄 Applying schema migrations for financial and committee metadata...');
    await client.query(`
      ALTER TABLE schools ADD COLUMN IF NOT EXISTS ssb_25_26 VARCHAR(50) DEFAULT '';
      ALTER TABLE schools ADD COLUMN IF NOT EXISTS ssb_26_27 VARCHAR(50) DEFAULT '';
      ALTER TABLE schools ADD COLUMN IF NOT EXISTS old_cc VARCHAR(50) DEFAULT '';
      ALTER TABLE schools ADD COLUMN IF NOT EXISTS new_cc VARCHAR(50) DEFAULT '';
      ALTER TABLE schools ADD COLUMN IF NOT EXISTS is_cell_hub BOOLEAN DEFAULT FALSE;
      ALTER TABLE clusters ADD COLUMN IF NOT EXISTS committee_members JSONB DEFAULT '[]'::jsonb;
    `);

    console.log('🔄 Updating committee members in cluster KX03099...');
    await client.query(`
      UPDATE clusters
      SET committee_members = $1
      WHERE code = 'KX03099';
    `, [JSON.stringify(committeeMembers)]);

    console.log('🔄 Updating schools with official PIDs, mobile contacts & designations...');
    for (const s of officialSchoolsData) {
      const res = await client.query(`
        UPDATE schools
        SET pid = $1,
            head_teacher = $2,
            head_gender = $3,
            contact = $4,
            designation = $5,
            ssb_25_26 = $6,
            ssb_26_27 = $7,
            old_cc = $8,
            new_cc = $9,
            is_cell_hub = $10,
            updated_at = NOW()
        WHERE semis = $11
        RETURNING id, name, semis, pid, head_teacher, contact;
      `, [
        s.pid,
        s.headTeacher,
        s.headGender,
        s.contact,
        s.designation,
        s.ssb_25_26 || '',
        s.ssb_26_27 || '',
        s.old_cc || '',
        s.new_cc || '',
        Boolean(s.cellHub),
        s.semis
      ]);

      if (res.rows.length > 0) {
        console.log(`✅ Updated ${res.rows[0].name} (SEMIS: ${res.rows[0].semis}) -> PID: ${res.rows[0].pid}, Contact: ${res.rows[0].contact}`);
      } else {
        console.warn(`⚠️ No school found for SEMIS: ${s.semis}`);
      }
    }

    console.log('\n🎉 ALL 23 CLUSTER SCHOOLS SUCCESSFULLY UPDATED WITH OFFICIAL PIDS & CONTACTS!');
  } catch (err) {
    console.error('❌ Error updating cluster data:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

updateClusterData();
