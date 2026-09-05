require('dotenv').config();
const { Pool } = require('pg');

// Build connection configuration
const isProduction = process.env.NODE_ENV === 'production';
let poolConfig = {};

if (process.env.DATABASE_URL) {
  const isInternalRailway = process.env.DATABASE_URL.includes('railway.internal');
  const isLocal = process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1');
  const needsSsl = process.env.PGSSL === 'true' || (!isLocal && !isInternalRailway && process.env.PGSSL !== 'false');
  
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: needsSsl ? { rejectUnauthorized: false } : false,
  };
} else {
  const host = process.env.PGHOST || '127.0.0.1';
  const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host.includes('railway.internal');
  poolConfig = {
    host,
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'jawadJAAN@1951',
    database: process.env.PGDATABASE || 'hub_cluster_db',
    ssl: (!isLocalHost && process.env.PGSSL !== 'false') || process.env.PGSSL === 'true'
      ? { rejectUnauthorized: false }
      : false,
  };
}

// Connection pool with keep-alive and timeouts
const pool = new Pool({
  ...poolConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

// School Types and their default class ranges
const TYPE_INFO = {
  GBHS:  { label: 'Boys High School',              classMin: 1, classMax: 10 },
  GBPS:  { label: 'Boys Primary School',           classMin: 1, classMax: 5 },
  GGPS:  { label: 'Girls Primary School',          classMin: 1, classMax: 5 },
  GBELS: { label: 'Boys Elementary Lower School',  classMin: 1, classMax: 8 },
  GGELS: { label: 'Girls Elementary Lower School', classMin: 1, classMax: 8 },
  GGHS:  { label: 'Girls Higher Secondary School', classMin: 6, classMax: 12 },
};

// Seed dataset from official cluster report KX03099
function getInitialSeedKX03099() {
  const schools = [];
  schools.push({
    id: 'hub',
    name: 'GBHS - THARI MIRWAH',
    type: 'GBHS',
    cell: 'HUB',
    isHub: true,
    classMin: 1,
    classMax: 10,
    semis: '415060805',
    pid: '10469301',
    headTeacher: 'Muammad Ansar Banb',
    headGender: 'Male',
    contact: '0303-3217216',
    designation: 'HM (BPS-17)',
    sortOrder: 0,
  });

  const c1 = [
    ['GBPS - AIJAZ HUSSAIN', '415060444', '10469547', 'Ghulam Hyder', 'Male', '0302-3283466', 'PST'],
    ['GBPS - GHULAM AKBAR JOGI', '415060838', '11016859', 'Weenjhar Ali', 'Male', '0322-3932939', 'PST'],
    ['GBPS - GHAZI JOGI', '415060724', '10308599', 'Manzoor Ahmed', 'Male', '0303-3249458', 'PST'],
    ['GBPS - JUMO BURDI AT OFFI', '415060656', '10308770', 'Zulfiqar Ali', 'Male', '0302-3660258', 'PST'],
    ['GBELS - THARI MIRWAH', '415060726', '10293591', 'Ameer Ahmed', 'Male', '0302-3606914', 'PST'],
    ['GBPS - KHABAR JOGI', '415060291', '11015828', 'Israr Hussain', 'Male', '0303-3358402', 'PST'],
    ['GBPS - GHULAM SHABIR LAGH', '415060666', '92037042', 'Allah Bux', 'Male', '0307-5080980', 'PST'],
    ['GBPS - HAJI FAIZ MUHAMMAD', '415060382', '10294191', 'Mahmood Hussain', 'Male', '0301-3401351', 'PST'],
    ['GBPS - ALI DAD JOGI', '415060042', '10469922', 'Hasnain Sardar Ali', 'Male', '0303-9655601', 'PST'],
    ['GBPS - NANDHI THARI', '415060290', '', '', '', '', ''],
    ['GBPS - HASSAN SHAH', '415060725', '', '', '', '', ''],
  ];
  c1.forEach((r, i) => {
    const type = r[0].startsWith('GBELS') ? 'GBELS' : 'GBPS';
    schools.push({
      id: `c1_${i + 1}`,
      name: r[0],
      type,
      cell: 'C1',
      isHub: false,
      classMin: TYPE_INFO[type].classMin,
      classMax: TYPE_INFO[type].classMax,
      semis: r[1],
      pid: r[2],
      headTeacher: r[3],
      headGender: r[4],
      contact: r[5],
      designation: r[6],
      sortOrder: i + 1,
    });
  });

  const c2 = [
    ['GGHS - THARI', '415060812', '10301370', 'Waheed Laghari', 'Female', '0306-6719929', 'Principal', 'GGHS'],
    ['GGPS - HAJI KHAN', '415060640', '10463921', 'Latifa Bibi', 'Female', '0302-2415461', 'PST', 'GGPS'],
    ['GGELS - ALI DAD JOGI', '415060557', '', '', '', '', '', 'GGELS'],
    ['GGPS - RUKHSANA LUQMAN SO', '415060635', '10821828', 'Ghazala', 'Male', '0305-3969021', 'PST', 'GGPS'],
    ['GGPS - KHABAR JOGI', '415060592', '11113571', 'Kiran Bhatti', 'Female', '0348-2076481', 'PST', 'GGPS'],
    ['GGPS - THARI MIRWAH', '415060520', '11038937', 'Rabel', 'Female', '0312-2004026', 'PST', 'GGPS'],
    ['GGPS - LAL MUHAMMAD (BRAN', '415060584', '10326598', 'Sajida', 'Female', '0328-8440348', 'PST', 'GGPS'],
    ['GGPS - MALLAH COLONY', '415060642', '10455390', 'Mubina', 'Female', '0302-2069051', 'PST', 'GGPS'],
    ['GGPS - NAWAZ ALI', '415060583', '10497200', 'Samina Begum', 'Female', '0333-7135475', 'PST', 'GGPS'],
    ['GGPS - FAIZ MUHAMMAD KHAS', '415060505', '', '', '', '', '', 'GGPS'],
    ['GGPS - NANDHI THARI', '415060597', '11041527', 'Fahmida', 'Female', '0308-8323066', 'PST', 'GGPS'],
  ];
  c2.forEach((r, i) => {
    const type = r[7] || 'GGPS';
    schools.push({
      id: `c2_${i + 1}`,
      name: r[0],
      type,
      cell: 'C2',
      isHub: false,
      classMin: TYPE_INFO[type].classMin,
      classMax: TYPE_INFO[type].classMax,
      semis: r[1],
      pid: r[2],
      headTeacher: r[3],
      headGender: r[4],
      contact: r[5],
      designation: r[6],
      sortOrder: 20 + i + 1,
    });
  });

  return {
    code: 'KX03099',
    district: 'Khairpur Mirs',
    schools,
  };
}

// Initialize tables and seed initial data if needed
async function initDb() {
  const client = await pool.connect();
  try {
    console.log('🔄 Initializing database schema...');
    await client.query('BEGIN');

    // Clusters Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS clusters (
        code VARCHAR(50) PRIMARY KEY,
        district VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Schools Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schools (
        id VARCHAR(100) PRIMARY KEY,
        cluster_code VARCHAR(50) NOT NULL REFERENCES clusters(code) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL,
        cell VARCHAR(50) NOT NULL DEFAULT 'HUB',
        is_hub BOOLEAN NOT NULL DEFAULT FALSE,
        class_min INTEGER NOT NULL DEFAULT 1,
        class_max INTEGER NOT NULL DEFAULT 5,
        semis VARCHAR(50) DEFAULT '',
        pid VARCHAR(50) DEFAULT '',
        head_teacher VARCHAR(255) DEFAULT '',
        head_gender VARCHAR(50) DEFAULT '',
        contact VARCHAR(100) DEFAULT '',
        designation VARCHAR(100) DEFAULT '',
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Class Records Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS class_records (
        id SERIAL PRIMARY KEY,
        school_id VARCHAR(100) NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        class_number INTEGER NOT NULL,
        boys INTEGER NOT NULL DEFAULT 0,
        girls INTEGER NOT NULL DEFAULT 0,
        muslim INTEGER NOT NULL DEFAULT 0,
        non_muslim INTEGER NOT NULL DEFAULT 0,
        sindhi INTEGER NOT NULL DEFAULT 0,
        urdu INTEGER NOT NULL DEFAULT 0,
        english INTEGER NOT NULL DEFAULT 0,
        furniture VARCHAR(50) NOT NULL DEFAULT 'available',
        sections INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT unique_school_class UNIQUE (school_id, class_number)
      );
    `);

    // Users Table (username only authentication)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'admin',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Seed default admin users
    const defaultPass = process.env.PGPASSWORD || 'jawadJAAN@1951';
    await client.query(`
      INSERT INTO users (username, password, role)
      VALUES ('admin', $1, 'admin'), ('jawad', $1, 'admin')
      ON CONFLICT (username) DO NOTHING;
    `, [defaultPass]);

    await client.query('COMMIT');

    // Check if initial cluster exists; if empty, seed default KX03099
    const countRes = await client.query('SELECT COUNT(*) FROM clusters');
    if (parseInt(countRes.rows[0].count, 10) === 0) {
      console.log('🌱 Database is empty. Seeding initial cluster KX03099...');
      const seed = getInitialSeedKX03099();
      await client.query('BEGIN');

      await client.query(
        'INSERT INTO clusters (code, district) VALUES ($1, $2)',
        [seed.code, seed.district]
      );

      for (const s of seed.schools) {
        await client.query(`
          INSERT INTO schools (
            id, cluster_code, name, type, cell, is_hub,
            class_min, class_max, semis, pid, head_teacher,
            head_gender, contact, designation, sort_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        `, [
          s.id, seed.code, s.name, s.type, s.cell, s.isHub,
          s.classMin, s.classMax, s.semis, s.pid, s.headTeacher,
          s.headGender, s.contact, s.designation, s.sortOrder,
        ]);

        // Insert initial empty class rows
        for (let cls = s.classMin; cls <= s.classMax; cls++) {
          await client.query(`
            INSERT INTO class_records (
              school_id, class_number, boys, girls, muslim,
              non_muslim, sindhi, urdu, english, furniture, sections
            ) VALUES ($1, $2, 0, 0, 0, 0, 0, 0, 0, 'available', 0)
            ON CONFLICT DO NOTHING
          `, [s.id, cls]);
        }
      }

      await client.query('COMMIT');
      console.log('✅ Seed completed successfully with 1 Hub and 22 Cell schools.');
    } else {
      console.log(`✅ Database already initialized (${countRes.rows[0].count} clusters found).`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Database initialization error:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Query Helpers
async function getAllClusters() {
  const clustersRes = await pool.query('SELECT * FROM clusters ORDER BY code ASC');
  const clusters = [];

  for (const c of clustersRes.rows) {
    const schoolsRes = await pool.query(`
      SELECT * FROM schools
      WHERE cluster_code = $1
      ORDER BY is_hub DESC, sort_order ASC, name ASC
    `, [c.code]);

    const schools = [];
    for (const s of schoolsRes.rows) {
      const classesRes = await pool.query(`
        SELECT * FROM class_records
        WHERE school_id = $1
        ORDER BY class_number ASC
      `, [s.id]);

      const classes = {};
      // Fill expected range
      for (let i = s.class_min; i <= s.class_max; i++) {
        classes[i] = {
          boys: 0, girls: 0, muslim: 0, nonMuslim: 0,
          sindhi: 0, urdu: 0, english: 0,
          furniture: 'available', sections: 0
        };
      }
      // Populate saved values
      for (const cr of classesRes.rows) {
        classes[cr.class_number] = {
          boys: cr.boys,
          girls: cr.girls,
          muslim: cr.muslim,
          nonMuslim: cr.non_muslim,
          sindhi: cr.sindhi,
          urdu: cr.urdu,
          english: cr.english,
          furniture: cr.furniture,
          sections: cr.sections,
        };
      }

      schools.push({
        id: s.id,
        name: s.name,
        type: s.type,
        cell: s.cell,
        isHub: s.is_hub,
        classMin: s.class_min,
        classMax: s.class_max,
        semis: s.semis || '',
        pid: s.pid || '',
        headTeacher: s.head_teacher || '',
        headGender: s.head_gender || '',
        contact: s.contact || '',
        designation: s.designation || '',
        sortOrder: s.sort_order,
        classes,
      });
    }

    clusters.push({
      code: c.code,
      district: c.district,
      schools,
    });
  }

  return clusters;
}

async function createCluster({ code, district, hubName }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO clusters (code, district) VALUES ($1, $2)',
      [code, district]
    );

    const hubId = `hub_${Date.now()}`;
    await client.query(`
      INSERT INTO schools (
        id, cluster_code, name, type, cell, is_hub,
        class_min, class_max, semis, pid, head_teacher,
        head_gender, contact, designation, sort_order
      ) VALUES ($1, $2, $3, 'GBHS', 'HUB', true, 1, 10, '', '', '', 'Male', '', '', 0)
    `, [hubId, code, hubName || 'New Hub School']);

    for (let cls = 1; cls <= 10; cls++) {
      await client.query(`
        INSERT INTO class_records (
          school_id, class_number, boys, girls, muslim,
          non_muslim, sindhi, urdu, english, furniture, sections
        ) VALUES ($1, $2, 0, 0, 0, 0, 0, 0, 0, 'available', 0)
      `, [hubId, cls]);
    }

    await client.query('COMMIT');
    return { code, district };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function addSchool(clusterCode, { name, type, cell }) {
  const info = TYPE_INFO[type] || TYPE_INFO.GBPS;
  const id = `cell_${Date.now()}`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      INSERT INTO schools (
        id, cluster_code, name, type, cell, is_hub,
        class_min, class_max, sort_order
      ) VALUES ($1, $2, $3, $4, $5, false, $6, $7, 99)
    `, [id, clusterCode, name, type, cell || 'C1', info.classMin, info.classMax]);

    for (let cls = info.classMin; cls <= info.classMax; cls++) {
      await client.query(`
        INSERT INTO class_records (
          school_id, class_number, boys, girls, muslim,
          non_muslim, sindhi, urdu, english, furniture, sections
        ) VALUES ($1, $2, 0, 0, 0, 0, 0, 0, 0, 'available', 0)
      `, [id, cls]);
    }

    await client.query('COMMIT');
    return { id, name, type, cell, classMin: info.classMin, classMax: info.classMax };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function updateSchool(id, fields) {
  const { name, type, cell, semis, pid, headTeacher, headGender, contact, designation } = fields;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if type changed
    const currRes = await client.query('SELECT type, class_min, class_max FROM schools WHERE id = $1', [id]);
    if (!currRes.rows.length) throw new Error('School not found');

    const curr = currRes.rows[0];
    let classMin = curr.class_min;
    let classMax = curr.class_max;

    if (type && type !== curr.type && TYPE_INFO[type]) {
      classMin = TYPE_INFO[type].classMin;
      classMax = TYPE_INFO[type].classMax;

      // Remove classes outside new range
      await client.query(
        'DELETE FROM class_records WHERE school_id = $1 AND (class_number < $2 OR class_number > $3)',
        [id, classMin, classMax]
      );

      // Ensure classes inside new range exist
      for (let cls = classMin; cls <= classMax; cls++) {
        await client.query(`
          INSERT INTO class_records (school_id, class_number)
          VALUES ($1, $2)
          ON CONFLICT (school_id, class_number) DO NOTHING
        `, [id, cls]);
      }
    }

    await client.query(`
      UPDATE schools SET
        name = COALESCE($2, name),
        type = COALESCE($3, type),
        cell = COALESCE($4, cell),
        semis = COALESCE($5, semis),
        pid = COALESCE($6, pid),
        head_teacher = COALESCE($7, head_teacher),
        head_gender = COALESCE($8, head_gender),
        contact = COALESCE($9, contact),
        designation = COALESCE($10, designation),
        class_min = $11,
        class_max = $12,
        updated_at = NOW()
      WHERE id = $1
    `, [
      id, name, type, cell, semis, pid,
      headTeacher, headGender, contact, designation,
      classMin, classMax
    ]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function deleteSchool(id) {
  await pool.query('DELETE FROM schools WHERE id = $1 AND is_hub = false', [id]);
}

async function updateSchoolClasses(schoolId, classesObj) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [cls, cd] of Object.entries(classesObj)) {
      const classNum = parseInt(cls, 10);
      await client.query(`
        INSERT INTO class_records (
          school_id, class_number, boys, girls, muslim,
          non_muslim, sindhi, urdu, english, furniture, sections, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (school_id, class_number) DO UPDATE SET
          boys = EXCLUDED.boys,
          girls = EXCLUDED.girls,
          muslim = EXCLUDED.muslim,
          non_muslim = EXCLUDED.non_muslim,
          sindhi = EXCLUDED.sindhi,
          urdu = EXCLUDED.urdu,
          english = EXCLUDED.english,
          furniture = EXCLUDED.furniture,
          sections = EXCLUDED.sections,
          updated_at = NOW()
      `, [
        schoolId, classNum,
        parseInt(cd.boys || 0, 10),
        parseInt(cd.girls || 0, 10),
        parseInt(cd.muslim || 0, 10),
        parseInt(cd.nonMuslim || 0, 10),
        parseInt(cd.sindhi || 0, 10),
        parseInt(cd.urdu || 0, 10),
        parseInt(cd.english || 0, 10),
        cd.furniture || 'available',
        parseInt(cd.sections || 0, 10),
      ]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function resetClusterClasses(clusterCode) {
  await pool.query(`
    UPDATE class_records
    SET boys = 0, girls = 0, muslim = 0, non_muslim = 0,
        sindhi = 0, urdu = 0, english = 0, furniture = 'available', sections = 0, updated_at = NOW()
    WHERE school_id IN (
      SELECT id FROM schools WHERE cluster_code = $1
    )
  `, [clusterCode]);
}

async function authenticateUser(username, password) {
  if (!username || !password) return null;
  try {
    const res = await pool.query(
      'SELECT id, username, role FROM users WHERE LOWER(username) = LOWER($1) AND password = $2',
      [username.trim(), password]
    );
    if (res.rows.length > 0) {
      return res.rows[0];
    }
  } catch (err) {
    console.error('Error during user authentication:', err.message);
  }

  // Fallback to default admin check
  const u = username.trim().toLowerCase();
  const defaultPass = process.env.PGPASSWORD || 'jawadJAAN@1951';
  if ((u === 'admin' || u === 'jawad') && password === defaultPass) {
    return { username: u, role: 'admin' };
  }
  return null;
}

module.exports = {
  pool,
  initDb,
  getAllClusters,
  createCluster,
  addSchool,
  updateSchool,
  deleteSchool,
  updateSchoolClasses,
  resetClusterClasses,
  authenticateUser,
  TYPE_INFO,
};
