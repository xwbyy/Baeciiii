const crypto = require('crypto');
const db = require('./sheetsDb');

const getSettings = async () => {
  const settings = await db.getSettings();
  return settings.panel || {};
};

const appHeaders = async () => {
  const settings = await getSettings();
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + (settings.apikey || '')
  };
};

const clientHeaders = async () => {
  const settings = await getSettings();
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + (settings.capikey || '')
  };
};

const createUser = async (username, firstName, lastName = 'User', rootAdmin = false) => {
  const settings = await getSettings();
  const email = `${username.toLowerCase()}@baeci.market`;
  const password = username.toLowerCase() + crypto.randomBytes(4).toString('hex');

  const response = await fetch(settings.domain + '/api/application/users', {
    method: 'POST',
    headers: await appHeaders(),
    body: JSON.stringify({
      email,
      username: username.toLowerCase(),
      first_name: firstName,
      last_name: lastName,
      root_admin: rootAdmin,
      language: 'en',
      password: password
    })
  });

  const data = await response.json();
  
  if (data.errors) {
    const errorMsg = data.errors[0]?.detail || JSON.stringify(data.errors);
    throw new Error(errorMsg);
  }

  return { user: data.attributes, password, email };
};

const createServer = async ({ name, userId, ram, disk, cpu }) => {
  const settings = await getSettings();
  
  const eggRes = await fetch(
    settings.domain + `/api/application/nests/${settings.nestid}/eggs/${settings.egg}`,
    { method: 'GET', headers: await appHeaders() }
  );
  const eggData = await eggRes.json();
  
  if (eggData.errors) {
    throw new Error('Gagal mengambil data egg: ' + JSON.stringify(eggData.errors));
  }
  
  const startup_cmd = eggData.attributes?.startup || 'npm start';
  const desc = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

  const serverRes = await fetch(settings.domain + '/api/application/servers', {
    method: 'POST',
    headers: await appHeaders(),
    body: JSON.stringify({
      name,
      description: desc,
      user: userId,
      egg: parseInt(settings.egg),
      docker_image: 'ghcr.io/parkervcp/yolks:nodejs_18',
      startup: startup_cmd,
      environment: {
        INST: 'npm',
        USER_UPLOAD: '0',
        AUTO_UPDATE: '0',
        CMD_RUN: 'npm start'
      },
      limits: {
        memory: ram,
        swap: 0,
        disk: disk,
        io: 500,
        cpu: cpu
      },
      feature_limits: {
        databases: 5,
        backups: 5,
        allocations: 5
      },
      deploy: {
        locations: [parseInt(settings.loc)],
        dedicated_ip: false,
        port_range: []
      }
    })
  });

  const result = await serverRes.json();
  
  if (result.errors) {
    const errorMsg = result.errors[0]?.detail || JSON.stringify(result.errors);
    throw new Error(errorMsg);
  }
  
  return result.attributes;
};

const getServerDetails = async (serverId) => {
  const settings = await getSettings();
  
  const response = await fetch(settings.domain + `/api/application/servers/${serverId}?include=allocations`, {
    method: 'GET',
    headers: await appHeaders()
  });
  
  const data = await response.json();
  return data.attributes || null;
};

const deleteServer = async (serverId) => {
  const settings = await getSettings();
  
  const response = await fetch(settings.domain + `/api/application/servers/${serverId}`, {
    method: 'DELETE',
    headers: await appHeaders()
  });
  
  return response.ok;
};

const deleteUser = async (userId) => {
  const settings = await getSettings();
  
  const response = await fetch(settings.domain + `/api/application/users/${userId}`, {
    method: 'DELETE',
    headers: await appHeaders()
  });
  
  return response.ok;
};

const testConnection = async () => {
  const settings = await getSettings();
  
  if (!settings.domain || !settings.apikey) {
    return { success: false, message: 'Panel belum dikonfigurasi' };
  }
  
  try {
    const response = await fetch(settings.domain + '/api/application/users?page=1', {
      method: 'GET',
      headers: await appHeaders()
    });
    
    const data = await response.json();
    
    if (data.errors) {
      return { success: false, message: data.errors[0]?.detail || 'API Error' };
    }
    
    return { 
      success: true, 
      message: 'Koneksi berhasil',
      totalUsers: data.meta?.pagination?.total || 0
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

module.exports = {
  createUser,
  createServer,
  getServerDetails,
  deleteServer,
  deleteUser,
  testConnection,
  getSettings
};
