// 基督教歌曲导航 - Cloudflare Workers with D1 & R2
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        try {
            await initializeDatabase(env.DB); // 确保数据库已初始化
            // Handle admin login (POST)
            if (path === '/admin' && request.method === 'POST') {
                return await handleAdminLogin(request, env.DB);
            }
            // Handle admin page (GET)
            if (path === '/admin' && request.method === 'GET') {
                return await handleAdminPage(request, env.DB);
            }
            if (path === '/admin/save' && request.method === 'POST') {
                return await handleSaveData(request, env.DB);
            }
            // 歌谱上传功能，对接 Cloudflare R2
            if (path === '/admin/upload-sheet' && request.method === 'POST') {
                 try {
                    const formData = await request.formData();
                    const file = formData.get('sheetFile');
                    // 检查文件是否存在且是文件类型
                    if (!file || typeof file === 'string') {
                        return new Response(JSON.stringify({ success: false, error: '没有选择文件或上传数据无效' }), {
                            status: 400,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                    // 检查 R2 Bucket 是否已在 wrangler.toml 中绑定
                    if (!env.GXSONGPIC) {
                         console.error('GXSONGPIC is not bound. Please check your wrangler.toml configuration.');
                         return new Response(JSON.stringify({ success: false, error: '服务器存储配置错误' }), {
                            status: 500,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                    // 1. 清理文件名，防止不安全字符
                    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9-._]/g, '_');
                    // 2. 创建一个唯一的对象 key (文件名)，防止重名覆盖
                    // 格式: sheets/时间戳-随机字符串-原始文件名
                    const key = `sheets/${Date.now()}-${Math.random().toString(36).substring(2, 10)}-${sanitizedFilename}`;
                    // 3. 上传文件到 R2
                    const uploadedObject = await env.GXSONGPIC.put(key, file.stream(), {
                        httpMetadata: {
                            contentType: file.type || 'application/octet-stream', // 设置正确的MIME类型
                        },
                    });
                    if (!uploadedObject) {
                        throw new Error('R2 upload failed, returned object is null.');
                    }
                    // 4. 构建公开访问的 URL (使用您的自定义域)
                    const customDomain = 'https://r2-gxsongpic.831017.xyz';
                    const imageUrl = `${customDomain}/${uploadedObject.key}`;
                    // 5. 返回成功的 JSON 响应
                    return new Response(JSON.stringify({
                        success: true,
                        imageUrl: imageUrl
                    }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                } catch (error) {
                    console.error('Upload Error:', error);
                    return new Response(JSON.stringify({ success: false, error: '文件上传失败: ' + error.message }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            }
            // 新增：音频文件上传功能，同样对接 R2
            if (path === '/admin/upload-audio' && request.method === 'POST') {
                try {
                    const formData = await request.formData();
                    const file = formData.get('audioFile');
                    // 检查文件是否存在且是文件类型
                    if (!file || typeof file === 'string') {
                        return new Response(JSON.stringify({ success: false, error: '没有选择音频文件或上传数据无效' }), {
                            status: 400,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                    // 检查 R2 Bucket 是否已在 wrangler.toml 中绑定
                    if (!env.GXSONGPIC) {
                        console.error('GXSONGPIC is not bound. Please check your wrangler.toml configuration.');
                        return new Response(JSON.stringify({ success: false, error: '服务器存储配置错误' }), {
                            status: 500,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                    // 1. 清理文件名，防止不安全字符
                    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9-._]/g, '_');
                    // 2. 创建一个唯一的对象 key (文件名)，防止重名覆盖
                    // 格式: audio/时间戳-随机字符串-原始文件名
                    const key = `audio/${Date.now()}-${Math.random().toString(36).substring(2, 10)}-${sanitizedFilename}`;
                    // 3. 上传文件到 R2
                    const uploadedObject = await env.GXSONGPIC.put(key, file.stream(), {
                        httpMetadata: {
                            contentType: file.type || 'application/octet-stream', // 设置正确的MIME类型
                        },
                    });
                    if (!uploadedObject) {
                        throw new Error('R2 upload failed, returned object is null.');
                    }
                    // 4. 构建公开访问的 URL (使用您的自定义域)
                    const customDomain = 'https://r2-gxsongpic.831017.xyz';
                    const audioUrl = `${customDomain}/${uploadedObject.key}`;
                    // 5. 返回成功的 JSON 响应
                    return new Response(JSON.stringify({
                        success: true,
                        audioUrl: audioUrl
                    }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                } catch (error) {
                    console.error('Audio Upload Error:', error);
                    return new Response(JSON.stringify({ success: false, error: '音频文件上传失败: ' + error.message }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            }
            if (path === '/admin/save-password' && request.method === 'POST') {
                return await handleSavePassword(request, env.DB);
            }
            if (path === '/admin/collections' && request.method === 'GET') {
                return await handleGetCollections(request, env.DB);
            }
            if (path.startsWith('/admin/edit/') && request.method === 'GET') {
                const collectionId = path.split('/')[3];
                return await handleEditCollection(request, env.DB, collectionId);
            }
            // 删除集合的API端点
            if (path.startsWith('/admin/delete/') && request.method === 'DELETE') {
                const collectionId = path.split('/')[3];
                return await handleDeleteCollection(request, env.DB, collectionId);
            }
            // 批量删除集合的API端点
            if (path === '/admin/delete-multiple' && request.method === 'POST') {
                return await handleDeleteMultiple(request, env.DB);
            }
            // 默认返回主页面
            return new Response(await generateHomePage(env.DB), {
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
        } catch (error) {
            console.error('Fetch Error:', error);
            return new Response(`Error: ${error.message}`, { status: 500 });
        }
    }
};
// 默认配置
const DEFAULT_CONFIG = {
    churchName: '郭溪教会',
    adminPassword: '222221',
    adminToken: 'simple-token-123' // Simple token for demo; use secure JWT in production
};
// 数据库初始化函数
async function initializeDatabase(db) {
    try {
        // 创建配置表
        await db.exec(`
        CREATE TABLE IF NOT EXISTS church_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          church_name TEXT NOT NULL,
          admin_password TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
        // 修改歌曲集合表，增加 collection_week_label 用于周次关键字
        await db.exec(`
        CREATE TABLE IF NOT EXISTS song_collections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          collection_name TEXT NOT NULL,
          collection_week_label TEXT NOT NULL UNIQUE, -- 新增周次标签，唯一
          publish_date TEXT DEFAULT CURRENT_DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
        // 创建歌曲表
        await db.exec(`
        CREATE TABLE IF NOT EXISTS songs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          collection_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          audio_url TEXT,
          visible BOOLEAN DEFAULT TRUE,
          sort_order INTEGER DEFAULT 0,
          FOREIGN KEY (collection_id) REFERENCES song_collections(id) ON DELETE CASCADE
        )
      `);
        // 创建歌谱表
        await db.exec(`
        CREATE TABLE IF NOT EXISTS sheet_music (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          song_id INTEGER NOT NULL,
          image_url TEXT NOT NULL,
          sort_order INTEGER DEFAULT 0,
          FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
        )
      `);
        // 检查是否有默认配置
        const config = await db.prepare('SELECT * FROM church_config LIMIT 1').first();
        if (!config) {
            await db.prepare(
                'INSERT INTO church_config (church_name, admin_password) VALUES (?, ?)'
            ).bind(DEFAULT_CONFIG.churchName, DEFAULT_CONFIG.adminPassword).run();
        }
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}
async function getConfig(db) {
    try {
        const result = await db.prepare('SELECT * FROM church_config ORDER BY id DESC LIMIT 1').first();
        if (result) {
            return result;
        }
        return DEFAULT_CONFIG;
    } catch (error) {
        console.error('Error getting config:', error);
        return DEFAULT_CONFIG;
    }
}
// 获取歌曲集合及其歌曲和歌谱的通用函数
async function getSongCollectionData(db, collectionId = null, limit = null) {
    let collectionsQuery = `SELECT sc.* FROM song_collections sc ORDER BY sc.created_at DESC`;
    if (limit) {
        collectionsQuery += ` LIMIT ${limit}`;
    }
    if (collectionId) {
        collectionsQuery = `SELECT sc.* FROM song_collections sc WHERE sc.id = ?`;
    }
    const collectionsResult = collectionId
        ? await db.prepare(collectionsQuery).bind(collectionId).all()
        : await db.prepare(collectionsQuery).all();
    if (!collectionsResult.results || collectionsResult.results.length === 0) {
        return collectionId ? null : [];
    }
    const collections = collectionsResult.results;
    const results = [];
    for (const collection of collections) {
        const songsResult = await db.prepare(`
          SELECT s.* FROM songs s
          WHERE s.collection_id = ?
          ORDER BY s.sort_order
        `).bind(collection.id).all();
        const songsWithSheets = [];
        if (songsResult.results && songsResult.results.length > 0) {
            for (const song of songsResult.results) {
                const sheetsResult = await db.prepare(`
              SELECT sm.* FROM sheet_music sm
              WHERE sm.song_id = ?
              ORDER BY sm.sort_order
            `).bind(song.id).all();
                songsWithSheets.push({
                    ...song,
                    sheets: sheetsResult.results || []
                });
            }
        }
        results.push({
            ...collection,
            songs: songsWithSheets
        });
    }
    return collectionId ? results[0] : results;
}
// 获取最新的两个歌曲集合
async function getLatestSongCollections(db) {
    return await getSongCollectionData(db, null, 2);
}
// 处理管理员登录
async function handleAdminLogin(request, db) {
    const formData = await request.formData();
    const password = formData.get('password');
    const config = await getConfig(db);
    if (password === config.admin_password) {
        // Return JSON with token instead of HTML
        const response = new Response(JSON.stringify({
            success: true,
            token: DEFAULT_CONFIG.adminToken
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Set-Cookie': `admin_token=${DEFAULT_CONFIG.adminToken}; Path=/; HttpOnly; SameSite=Strict`
            }
        });
        return response;
    }
    return new Response(JSON.stringify({ success: false, error: '密码错误' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
    });
}
// 处理管理员页面 (GET /admin)
async function handleAdminPage(request, db) {
    const cookies = request.headers.get('Cookie') || '';
    const tokenMatch = cookies.match(/admin_token=([^;]+)/);
    const token = tokenMatch ? tokenMatch[1] : null;
    if (token === DEFAULT_CONFIG.adminToken) {
        const adminPage = await generateAdminPage(db);
        return new Response(adminPage, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }
    // Redirect to homepage if not authenticated
    return new Response('未授权，请先登录', {
        status: 403,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
}
// 处理保存数据
async function handleSaveData(request, db) {
    try {
        const formData = await request.formData();
        const churchName = formData.get('churchName');
        const weekLabel = formData.get('weekLabel');
        const collectionIdToUpdate = formData.get('collectionId'); // 新增：用于更新现有集合
        if (!weekLabel) {
            return new Response(JSON.stringify({ success: false, error: '周次标签不能为空' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        // 更新教会名称
        if (churchName) {
            await db.prepare(
                'UPDATE church_config SET church_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM church_config ORDER BY id DESC LIMIT 1)'
            ).bind(churchName).run();
        }
        let collectionId;
        if (collectionIdToUpdate) {
            // 如果提供了 collectionId，则更新现有集合
            collectionId = collectionIdToUpdate;
            await db.prepare(
                'UPDATE song_collections SET collection_name = ?, collection_week_label = ?, publish_date = CURRENT_DATE, created_at = CURRENT_TIMESTAMP WHERE id = ?'
            ).bind(weekLabel, weekLabel, collectionId).run();
        } else {
            // 否则，检查是否存在同名的集合，不存在则创建新集合
            const existingCollection = await db.prepare(
                'SELECT id FROM song_collections WHERE collection_week_label = ?'
            ).bind(weekLabel).first();
            if (existingCollection) {
                collectionId = existingCollection.id;
                // 更新现有集合的名称、发布日期和创建时间（重要，确保排序正确）
                await db.prepare(
                    'UPDATE song_collections SET collection_name = ?, publish_date = CURRENT_DATE, created_at = CURRENT_TIMESTAMP WHERE id = ?'
                ).bind(weekLabel, collectionId).run();
            } else {
                const result = await db.prepare(
                    `INSERT INTO song_collections (collection_name, collection_week_label, publish_date) 
                   VALUES (?, ?, CURRENT_DATE) RETURNING id`
                ).bind(weekLabel, weekLabel).first();
                collectionId = result.id;
            }
        }
        if (collectionId) {
            await db.prepare('DELETE FROM sheet_music WHERE song_id IN (SELECT id FROM songs WHERE collection_id = ?)').bind(collectionId).run();
            await db.prepare('DELETE FROM songs WHERE collection_id = ?').bind(collectionId).run();
            let songIndex = 0;
            while (formData.has(`song_${songIndex}_title`)) {
                const title = formData.get(`song_${songIndex}_title`);
                // 修正：优先使用直接粘贴的链接，如果没有，则使用可能由上传生成的链接
                const audioUrl = formData.get(`song_${songIndex}_audioUrl`) || '';
                const visible = formData.has(`song_${songIndex}_visible`);
                if (title) {
                    const songResult = await db.prepare(
                        'INSERT INTO songs (collection_id, title, audio_url, visible, sort_order) VALUES (?, ?, ?, ?, ?) RETURNING id'
                    ).bind(collectionId, title, audioUrl, visible ? 1 : 0, songIndex).first();
                    const songId = songResult.id;
                    let sheetIndex = 0;
                    while (formData.has(`song_${songIndex}_sheet_${sheetIndex}`)) {
                        const sheetUrl = formData.get(`song_${songIndex}_sheet_${sheetIndex}`);
                        if (sheetUrl) {
                            await db.prepare(
                                'INSERT INTO sheet_music (song_id, image_url, sort_order) VALUES (?, ?, ?)'
                            ).bind(songId, sheetUrl, sheetIndex).run();
                        }
                        sheetIndex++;
                    }
                }
                songIndex++;
            }
        }
        return new Response(JSON.stringify({ success: true, collectionId: collectionId }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Save Data Error:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
// 处理保存密码
async function handleSavePassword(request, db) {
    try {
        const formData = await request.formData();
        const newPassword = formData.get('newPassword');
        await db.prepare(
            'UPDATE church_config SET admin_password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM church_config ORDER BY id DESC LIMIT 1)'
        ).bind(newPassword).run();
        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
// 获取所有集合列表（支持分页）
async function handleGetCollections(request, db) {
    try {
        const url = new URL(request.url);
        let page = parseInt(url.searchParams.get('page')) || 1;
        let perPage = parseInt(url.searchParams.get('perPage')) || 10;
        if (page < 1) page = 1;
        if (perPage < 1) perPage = 10;
        const offset = (page - 1) * perPage;
        const totalResult = await db.prepare('SELECT COUNT(*) as total FROM song_collections').first();
        const total = totalResult.total;
        const collections = await db.prepare(`
            SELECT id, collection_name, collection_week_label, publish_date 
            FROM song_collections 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `).bind(perPage, offset).all();
        return new Response(JSON.stringify({ 
            success: true, 
            collections: collections.results || [], 
            total,
            page,
            perPage
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error getting collections:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
// 获取单个集合用于编辑
async function handleEditCollection(request, db, collectionId) {
    try {
        const collectionData = await getSongCollectionData(db, collectionId);
        if (collectionData) {
            return new Response(JSON.stringify({ success: true, collection: collectionData }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            return new Response(JSON.stringify({ success: false, error: 'Collection not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    } catch (error) {
        console.error('Error editing collection:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
// 处理删除集合
async function handleDeleteCollection(request, db, collectionId) {
    try {
        if (!collectionId) {
            return new Response(JSON.stringify({ success: false, error: 'Collection ID is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        // 由于设置了外键约束和ON DELETE CASCADE，删除集合会自动删除相关的歌曲和歌谱
        const result = await db.prepare('DELETE FROM song_collections WHERE id = ?').bind(collectionId).run();
        if (result.meta.changes > 0) {
            return new Response(JSON.stringify({ success: true, message: 'Collection deleted successfully' }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            return new Response(JSON.stringify({ success: false, error: 'Collection not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    } catch (error) {
        console.error('Error deleting collection:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
// 处理批量删除集合
async function handleDeleteMultiple(request, db) {
    try {
        const formData = await request.formData();
        const ids = JSON.parse(formData.get('ids')) || [];
        if (!Array.isArray(ids) || ids.length === 0) {
            return new Response(JSON.stringify({ success: false, error: 'No collection IDs provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        const placeholders = ids.map(() => '?').join(',');
        const result = await db.prepare(`DELETE FROM song_collections WHERE id IN (${placeholders})`).bind(...ids).run();
        if (result.meta.changes > 0) {
            return new Response(JSON.stringify({ success: true, message: 'Collections deleted successfully' }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            return new Response(JSON.stringify({ success: false, error: 'No collections found to delete' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    } catch (error) {
        console.error('Error deleting multiple collections:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
// 生成中文周次标签的函数
function generateWeekLabel(offset = 0) {
    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + offset * 7); // 根据偏移量调整周数
    // 中文月份名称
    const chineseMonths = ['一月', '二月', '三月', '四月', '五月', '六月',
        '七月', '八月', '九月', '十月', '十一月', '十二月'
    ];
    const month = chineseMonths[targetDate.getMonth()];
    // 计算是当月的第几周（周日为每周的第一天）
    const firstDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const firstDayOfWeek = firstDay.getDay(); // 0是周日，6是周六
    // 计算当前日期是该月的第几天
    const dayOfMonth = targetDate.getDate();
    // 计算当前日期是该月的第几周
    let weekNumber = Math.ceil((dayOfMonth + firstDayOfWeek) / 7);
    // 中文周数
    const chineseWeeks = ['一周', '二周', '三周', '四周', '五周', '六周'];
    const week = weekNumber <= 6 ? chineseWeeks[weekNumber - 1] : `${weekNumber}周`;
    return `${targetDate.getFullYear()}年${month}${week}`;
}
// 主页生成
async function generateHomePage(db) {
    await initializeDatabase(db);
    const config = await getConfig(db);
    const collections = await getLatestSongCollections(db);
    // 修正：最新的记录 (collections[0]) 应该是下周，次新的 (collections[1]) 应该是本周
    // 如果只有一个记录，则它被视为本周
    const currentWeek = collections.length > 1 ? collections[1] : collections[0] || { songs: [], collection_week_label: '未设置本周' };
    const nextWeek = collections.length > 1 ? collections[0] : { songs: [], collection_week_label: '未设置下周' };
    return `<!DOCTYPE html>
  <html lang="zh-CN">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${config.church_name} - 主日崇拜诗歌导航</title>
      <style>
          * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
          }
          body {
              font-family: 'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
              background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
              min-height: 100vh;
              color: #333;
              position: relative; /* For footer */
              padding-bottom: 80px; /* Space for fixed footer */
          }
          .container {
              max-width: 1200px;
              margin: 0 auto;
              padding: 20px;
          }
          .header {
              text-align: center;
              color: white;
              margin-bottom: 40px;
              padding: 30px 0;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 15px;
              backdrop-filter: blur(10px);
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
              position: relative; /* For current week label */
          }
          .header h1 {
              font-size: 2.5em;
              margin-bottom: 10px;
              color: #ffd700;
              text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
          }
          .header p {
              font-size: 1.1em;
              opacity: 0.9;
          }
          .current-week-label {
              position: absolute;
              top: 20px;
              right: 20px;
              background: #ffd700;
              color: #1e3c72;
              padding: 8px 15px;
              border-radius: 20px;
              font-weight: bold;
              font-size: 0.9em;
              box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          }
          .tabs-container {
              background: rgba(255, 255, 255, 0.95);
              border-radius: 15px;
              padding: 0 30px 30px;
              box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
              margin-bottom: 50px;
          }
          .tabs {
              display: flex;
              justify-content: center;
              border-bottom: 2px solid #eee;
              margin-bottom: 20px;
          }
          .tab-btn {
              background: none;
              border: none;
              padding: 15px 25px;
              cursor: pointer;
              font-size: 1.2em;
              color: #555;
              transition: all 0.3s ease;
          }
          .tab-btn.active {
              color: #2a5298;
              border-bottom: 3px solid #2a5298;
              font-weight: bold;
          }
          .tab-content {
              display: none;
          }
          .tab-content.active {
              display: block;
          }
          .week-title {
              font-size: 1.8em;
              color: #2a5298;
              margin-bottom: 25px;
              text-align: center;
              border-bottom: 3px solid #ffd700;
              padding-bottom: 10px;
          }
          .songs-list {
              display: grid;
              gap: 20px;
              margin-bottom: 30px;
          }
          .song-item {
              background: white;
              border-radius: 10px;
              padding: 20px;
              box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
              display: flex;
              justify-content: space-between;
              align-items: center;
          }
          .song-info {
              flex: 1;
          }
          .song-title {
              font-size: 1.2em;
              font-weight: bold;
              color: #2a5298;
              margin-bottom: 5px;
          }
          .play-btn {
              background: linear-gradient(135deg, #2a5298 0%, #1e3c72 100%);
              color: white;
              border: none;
              border-radius: 25px;
              padding: 10px 20px;
              cursor: pointer;
              transition: all 0.3s ease;
              font-size: 14px;
              font-weight: bold;
          }
          .play-btn:hover {
              transform: translateY(-2px);
              box-shadow: 0 5px 15px rgba(42, 82, 152, 0.4);
          }
          .play-btn:disabled {
              background: #ccc;
              cursor: not-allowed;
              transform: none;
              box-shadow: none;
          }
          .sheets-container {
              background: #f8f9fa;
              border-radius: 10px;
              padding: 20px;
              margin-top: 20px;
          }
          .sheets-title {
              font-size: 1.1em;
              color: #2a5298;
              margin-bottom: 15px;
              text-align: center;
          }
          .sheet-carousel {
              position: relative;
              overflow: hidden;
              border-radius: 8px;
              width: 100%;
              margin: 0 auto;
          }
          .sheet-slides {
              display: flex;
              transition: transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          }
          .sheet-slide {
              min-width: 100%;
              text-align: center;
              padding: 10px;
          }
          .sheet-image {
              width: 100%;
              height: auto;
              max-height: 80vh;
              object-fit: contain;
              border-radius: 5px;
              box-shadow: 0 4px 10px rgba(0,0,0,0.1);
              cursor: pointer;
          }
          .carousel-nav {
              display: flex;
              justify-content: center;
              gap: 10px;
              margin-top: 15px;
          }
          .nav-btn {
              background: #2a5298;
              color: white;
              border: none;
              border-radius: 20px;
              padding: 8px 15px;
              cursor: pointer;
              font-size: 12px;
          }
          .nav-btn:hover {
              background: #1e3c72;
          }
          .nav-btn:disabled {
              background: #ccc;
              cursor: not-allowed;
          }
          .fullscreen-overlay {
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: rgba(0, 0, 0, 0.9);
              display: flex;
              justify-content: center;
              align-items: center;
              z-index: 9999;
              visibility: hidden;
              opacity: 0;
              transition: visibility 0s, opacity 0.3s linear;
          }
          .fullscreen-overlay.visible {
              visibility: visible;
              opacity: 1;
          }
          .fullscreen-image {
              max-width: 95%;
              max-height: 95%;
              object-fit: contain;
          }
          .close-fullscreen {
              position: absolute;
              top: 20px;
              right: 20px;
              color: white;
              font-size: 30px;
              cursor: pointer;
              background: rgba(0,0,0,0.5);
              border-radius: 50%;
              width: 40px;
              height: 40px;
              display: flex;
              justify-content: center;
              align-items: center;
          }
          .audio-player {
              margin-top: 15px;
              background: rgba(255, 255, 255, 0.95);
              border-radius: 25px;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
              padding: 10px 20px;
              display: flex;
              align-items: center;
              gap: 10px;
              width: 90%;
              max-width: 800px;
              position: fixed; 
              bottom: 80px; 
              left: 50%; 
              transform: translateX(-50%); 
              z-index:1000;
              transition: width 0.3s ease;
          }
          .audio-controls {
              display: flex;
              align-items: center;
              gap: 10px;
              flex-grow: 1;
          }
          .audio-controls button {
              background: none;
              border: none;
              font-size: 1.5em;
              cursor: pointer;
              color: #2a5298;
              transition: transform 0.2s ease;
          }
          .audio-controls button:hover {
              transform: scale(1.1);
          }
          #currentSong {
              font-weight: bold;
              color: #2a5298;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              flex-shrink: 0;
              width: 150px;
              text-align: left;
          }
          @media (min-width: 769px) {
            #progressBarContainer {
                flex-grow: 1;
                height: 8px;
                background: #e0e0e0;
                border-radius: 4px;
                cursor: pointer;
                margin: 0 15px;
                position: relative;
            }
            #currentSong {
                width: 200px;
            }
          }
          @media (max-width: 768px) {
            .audio-player {
                width: 95%;
                padding: 8px 15px;
                bottom: 60px;
            }
            #progressBarContainer {
                flex-grow: 1;
                height: 8px;
                background: #e0e0e0;
                border-radius: 4px;
                cursor: pointer;
                margin: 0 8px;
                position: relative;
            }
            #currentSong {
                width: 80px;
            }
          }
          #progressBar {
              height: 100%;
              width: 0%;
              background: #2a5298;
              border-radius: 4px;
              transition: width 0.1s linear;
          }
          #timeDisplay {
              font-size: 0.9em;
              color: #555;
              min-width: 70px;
              text-align: right;
              flex-shrink: 0;
          }
          .admin-login {
              position: fixed;
              bottom: 20px;
              right: 20px;
              background: rgba(42, 82, 152, 0.9);
              border-radius: 50px;
              padding: 15px 25px;
              box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
              backdrop-filter: blur(5px);
              z-index: 1000;
          }
          .admin-btn {
              background: none;
              border: none;
              color: white;
              font-size: 14px;
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: 8px;
          }
          .login-form {
              display: none;
              margin-top: 10px;
          }
          .login-form input {
              padding: 8px 12px;
              border: none;
              border-radius: 5px;
              margin-right: 5px;
              width: 120px;
          }
          .login-form button {
              padding: 8px 15px;
              background: #ffd700;
              border: none;
              border-radius: 5px;
              color: #2a5298;
              font-weight: bold;
              cursor: pointer;
          }
          /* Footer */
          .footer {
              position: fixed;
              bottom: 0;
              width: 100%;
              background: rgba(255, 255, 255, 0.1);
              color: white;
              text-align: center;
              padding: 15px 0;
              font-size: 0.9em;
              backdrop-filter: blur(5px);
              box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
              z-index: 999;
          }
          @media (max-width: 480px) {
              .header h1 {
                  font-size: 1.8em;
              }
              .week-title {
                  font-size: 1.5em;
              }
              .song-item {
                  flex-direction: column;
                  gap: 10px;
                  padding: 15px;
              }
              .song-title {
                  font-size: 1.1em;
              }
              .play-btn {
                  padding: 8px 15px;
                  font-size: 12px;
              }
              .audio-player {
                  bottom: 10px;
                  width: 98%;
                  max-width: none;
              }
              #currentSong {
                  width: 60px;
                  font-size: 0.9em;
              }
              .audio-controls button {
                font-size: 1.2em;
              }
              #timeDisplay {
                min-width: 60px;
                font-size: 0.8em;
              }
              .admin-login {
                  bottom: 10px;
                  right: 10px;
                  padding: 10px 15px;
              }
              .tabs-container {
                padding: 0 15px 15px;
              }
              .tab-btn {
                font-size: 1em;
                padding: 10px 15px;
              }
              .current-week-label {
                top: 10px;
                right: 10px;
                padding: 5px 10px;
                font-size: 0.8em;
              }
          }
      </style>
  </head>
  <body>
      <div class="container">
          <div class="header">
              <h1>✞ ${config.church_name} ✞</h1>
              <p>主日崇拜诗歌导航</p>
              <div class="current-week-label">本周：${currentWeek.collection_week_label.split('年')[1] || ''}</div>
          </div>
          <div class="tabs-container">
              <div class="tabs">
                  <button class="tab-btn active" onclick="switchMainTab('currentWeekTab')">本周曲目</button>
                  <button class="tab-btn" onclick="switchMainTab('nextWeekTab')">下周曲目</button>
              </div>
              <!-- 本周歌曲 -->
              <div class="tab-content active" id="currentWeekTab">
                  <h2 class="week-title">🗓️ ${currentWeek.collection_week_label}</h2>
                  <div class="songs-list">
                      ${(currentWeek.songs || []).filter(song => song.visible).map((song, songIdx) => `
                          <div class="song-item">
                              <div class="song-info">
                                  <div class="song-title">${song.title}</div>
                              </div>
                              <button class="play-btn" 
                                  onclick="playAudio('${song.audio_url || ''}', '${song.title}', 'currentWeek', ${songIdx})" 
                                  ${!song.audio_url ? 'disabled' : ''}>
                                  ${song.audio_url ? '🎵 播放' : '暂无音频'}
                              </button>
                          </div>
                      `).join('')}
                  </div>
                  ${(currentWeek.songs || []).some(song => song.sheets && song.sheets.length > 0) ? `
                      <div class="sheets-container">
                          <h3 class="sheets-title">📖 歌谱展示</h3>
                          <div class="sheet-carousel" id="currentWeekCarousel">
                              <div class="sheet-slides" id="currentWeekSlides" data-carousel-name="currentWeek">
                                  ${(currentWeek.songs || []).flatMap((song, songIdx) => 
                                      (song.sheets || []).map((sheet, sheetIdx) => `
                                          <div class="sheet-slide" data-song-idx="${songIdx}" data-sheet-idx="${sheetIdx}">
                                              <img src="${sheet.image_url}" alt="${song.title} 歌谱" class="sheet-image" onclick="viewFullscreen(this.src)">
                                              <p>${song.title}</p>
                                          </div>
                                      `)
                                  ).join('')}
                              </div>
                              <div class="carousel-nav">
                                  <button class="nav-btn" onclick="prevSlide('currentWeek')">上一张</button>
                                  <button class="nav-btn" onclick="nextSlide('currentWeek')">下一张</button>
                              </div>
                          </div>
                      </div>
                  ` : ''}
              </div>
              <!-- 下周歌曲 -->
              <div class="tab-content" id="nextWeekTab">
                  <h2 class="week-title">🗓️ ${nextWeek.collection_week_label}</h2>
                  <div class="songs-list">
                      ${(nextWeek.songs || []).filter(song => song.visible).map((song, songIdx) => `
                          <div class="song-item">
                              <div class="song-info">
                                  <div class="song-title">${song.title}</div>
                              </div>
                              <button class="play-btn" 
                                  onclick="playAudio('${song.audio_url || ''}', '${song.title}', 'nextWeek', ${songIdx})" 
                                  ${!song.audio_url ? 'disabled' : ''}>
                                  ${song.audio_url ? '🎵 播放' : '暂无音频'}
                              </button>
                          </div>
                      `).join('')}
                  </div>
                  ${(nextWeek.songs || []).some(song => song.sheets && song.sheets.length > 0) ? `
                      <div class="sheets-container">
                          <h3 class="sheets-title">📖 歌谱展示</h3>
                          <div class="sheet-carousel" id="nextWeekCarousel">
                              <div class="sheet-slides" id="nextWeekSlides" data-carousel-name="nextWeek">
                                  ${(nextWeek.songs || []).flatMap((song, songIdx) => 
                                      (song.sheets || []).map((sheet, sheetIdx) => `
                                          <div class="sheet-slide" data-song-idx="${songIdx}" data-sheet-idx="${sheetIdx}">
                                              <img src="${sheet.image_url}" alt="${song.title} 歌谱" class="sheet-image" onclick="viewFullscreen(this.src)">
                                              <p>${song.title}</p>
                                          </div>
                                      `)
                                  ).join('')}
                              </div>
                              <div class="carousel-nav">
                                  <button class="nav-btn" onclick="prevSlide('nextWeek')">上一张</button>
                                  <button class="nav-btn" onclick="nextSlide('nextWeek')">下一张</button>
                              </div>
                          </div>
                      </div>
                  ` : ''}
              </div>
          </div>
      </div>
      <!-- 音频播放器 -->
      <div class="audio-player" id="audioPlayer" style="display: none;">
          <div class="audio-controls">
              <button id="prevBtn" onclick="playPrev()">⏮</button>
              <button id="playPauseBtn" onclick="togglePlayPause()">▶</button>
              <button id="nextBtn" onclick="playNext()">⏭</button>
              <span id="currentSong">未选择歌曲</span>
              <div id="progressBarContainer" onclick="seekAudio(event)">
                  <div id="progressBar"></div>
              </div>
              <span id="timeDisplay">0:00 / 0:00</span>
          </div>
      </div>
      <!-- 全屏查看歌谱 -->
      <div class="fullscreen-overlay" id="fullscreenOverlay" onclick="closeFullscreen()">
          <span class="close-fullscreen" onclick="event.stopPropagation(); closeFullscreen()">✕</span>
          <img class="fullscreen-image" id="fullscreenImage">
      </div>
      <!-- 管理员登录按钮 -->
      <div class="admin-login">
          <button class="admin-btn" onclick="toggleLoginForm()">⚙️ 管理</button>
          <div class="login-form" id="loginForm">
              <input type="password" id="adminPassword" placeholder="输入管理员密码">
              <button onclick="adminLogin()">登录</button>
          </div>
      </div>
      <!-- 页脚 -->
      <div class="footer">
          © 2023 ${config.church_name} - 主日崇拜诗歌导航系统
      </div>
      <script>
          // 全局变量
          let currentAudio = null;
          let currentPlaylist = { currentWeek: [], nextWeek: [] };
          let currentPlaylistType = null;
          let currentSongIndex = -1;
          let isPlaying = false;
          let carouselStates = {
              currentWeek: { currentIndex: 0, totalSlides: 0 },
              nextWeek: { currentIndex: 0, totalSlides: 0 }
          };
          // 存储歌曲和歌谱的映射关系
          const songSheetMap = {
              currentWeek: ${JSON.stringify(currentWeek.songs || [])},
              nextWeek: ${JSON.stringify(nextWeek.songs || [])}
          };
          // 初始化轮播状态
          document.addEventListener('DOMContentLoaded', function() {
              // 初始化本周轮播
              const currentWeekSlides = document.getElementById('currentWeekSlides');
              if (currentWeekSlides) {
                  carouselStates.currentWeek.totalSlides = currentWeekSlides.children.length;
                  updateCarousel('currentWeek');
              }
              // 初始化下周轮播
              const nextWeekSlides = document.getElementById('nextWeekSlides');
              if (nextWeekSlides) {
                  carouselStates.nextWeek.totalSlides = nextWeekSlides.children.length;
                  updateCarousel('nextWeek');
              }
              // 初始化播放列表
              ${JSON.stringify(currentWeek.songs)}.forEach(song => {
                  if (song.audio_url) {
                      currentPlaylist.currentWeek.push({
                          title: song.title,
                          url: song.audio_url
                      });
                  }
              });
              ${JSON.stringify(nextWeek.songs)}.forEach(song => {
                  if (song.audio_url) {
                      currentPlaylist.nextWeek.push({
                          title: song.title,
                          url: song.audio_url
                      });
                  }
              });
          });
          // 切换主标签页
          function switchMainTab(tabId) {
              document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
              document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
              document.getElementById(tabId).classList.add('active');
              document.querySelector(\`[onclick="switchMainTab('\${tabId}')"]\`).classList.add('active');
          }
          // 播放音频并切换到对应歌谱
          function playAudio(url, title, playlistType, songIndex) {
              if (!url) return;
              // 停止当前播放
              if (currentAudio) {
                  currentAudio.pause();
              }
              // 创建新的音频
              currentAudio = new Audio(url);
              currentPlaylistType = playlistType;
              currentSongIndex = songIndex;
              // 更新UI
              document.getElementById('currentSong').textContent = title;
              document.getElementById('audioPlayer').style.display = 'flex';
              // 设置事件监听
              currentAudio.addEventListener('timeupdate', updateProgressBar);
              currentAudio.addEventListener('ended', playNext);
              // 播放
              currentAudio.play();
              isPlaying = true;
              document.getElementById('playPauseBtn').textContent = '⏸';
              // 切换到对应歌曲的歌谱
              const slides = document.getElementById(\`\${playlistType}Slides\`);
              if (slides && carouselStates[playlistType].totalSlides > 0) {
                  let targetIndex = 0;
                  // 计算该歌曲的第一张歌谱的索引
                  for (let i = 0; i < songIndex; i++) {
                      targetIndex += (songSheetMap[playlistType][i]?.sheets?.length || 0);
                  }
                  // 如果歌曲有歌谱，切换到第一张歌谱
                  if (songSheetMap[playlistType][songIndex]?.sheets?.length > 0) {
                      carouselStates[playlistType].currentIndex = targetIndex;
                      updateCarousel(playlistType);
                  }
              }
          }
          // 切换播放/暂停
          function togglePlayPause() {
              if (!currentAudio) return;
              if (isPlaying) {
                  currentAudio.pause();
                  document.getElementById('playPauseBtn').textContent = '▶';
              } else {
                  currentAudio.play();
                  document.getElementById('playPauseBtn').textContent = '⏸';
              }
              isPlaying = !isPlaying;
          }
          // 更新进度条
          function updateProgressBar() {
              if (!currentAudio) return;
              const progressPercent = (currentAudio.currentTime / currentAudio.duration) * 100;
              document.getElementById('progressBar').style.width = progressPercent + '%';
              // 更新时间显示
              const currentTime = formatTime(currentAudio.currentTime);
              const duration = formatTime(currentAudio.duration);
              document.getElementById('timeDisplay').textContent = \`\${currentTime} / \${duration}\`;
          }
          // 格式化时间
          function formatTime(seconds) {
              const mins = Math.floor(seconds / 60);
              const secs = Math.floor(seconds % 60);
              return \`\${mins}:\${secs.toString().padStart(2, '0')}\`;
          }
          // 跳转播放位置
          function seekAudio(event) {
              if (!currentAudio) return;
              const progressBar = document.getElementById('progressBarContainer');
              const rect = progressBar.getBoundingClientRect();
              const seekPercent = (event.clientX - rect.left) / rect.width;
              currentAudio.currentTime = seekPercent * currentAudio.duration;
          }
          // 播放下一首
          function playNext() {
              if (!currentPlaylistType || currentSongIndex === -1) return;
              const playlist = currentPlaylist[currentPlaylistType];
              if (playlist.length === 0) return;
              const nextIndex = (currentSongIndex + 1) % playlist.length;
              const nextSong = playlist[nextIndex];
              playAudio(nextSong.url, nextSong.title, currentPlaylistType, nextIndex);
          }
          // 播放上一首
          function playPrev() {
              if (!currentPlaylistType || currentSongIndex === -1) return;
              const playlist = currentPlaylist[currentPlaylistType];
              if (playlist.length === 0) return;
              const prevIndex = (currentSongIndex - 1 + playlist.length) % playlist.length;
              const prevSong = playlist[prevIndex];
              playAudio(prevSong.url, prevSong.title, currentPlaylistType, prevIndex);
          }
          // 轮播控制
          function updateCarousel(type) {
              const slides = document.getElementById(\`\${type}Slides\`);
              if (!slides || carouselStates[type].totalSlides === 0) return;
              const translateX = -carouselStates[type].currentIndex * 100;
              slides.style.transform = \`translateX(\${translateX}%)\`;
          }
          function nextSlide(type) {
              if (carouselStates[type].totalSlides === 0) return;
              carouselStates[type].currentIndex = (carouselStates[type].currentIndex + 1) % carouselStates[type].totalSlides;
              updateCarousel(type);
          }
          function prevSlide(type) {
              if (carouselStates[type].totalSlides === 0) return;
              carouselStates[type].currentIndex = (carouselStates[type].currentIndex - 1 + carouselStates[type].totalSlides) % carouselStates[type].totalSlides;
              updateCarousel(type);
          }
          // 全屏查看歌谱
          function viewFullscreen(src) {
              document.getElementById('fullscreenImage').src = src;
              document.getElementById('fullscreenOverlay').classList.add('visible');
          }
          function closeFullscreen() {
              document.getElementById('fullscreenOverlay').classList.remove('visible');
          }
          // 管理员登录
          function toggleLoginForm() {
              const form = document.getElementById('loginForm');
              form.style.display = form.style.display === 'block' ? 'none' : 'block';
          }
          async function adminLogin() {
              const password = document.getElementById('adminPassword').value;
              if (!password) {
                  alert('请输入密码');
                  return;
              }
              try {
                  const formData = new FormData();
                  formData.append('password', password);
                  const response = await fetch('/admin', {
                      method: 'POST',
                      body: formData
                  });
                  const result = await response.json();
                  if (result.success) {
                      // Store token in cookie (already set by server via Set-Cookie)
                      window.location.href = '/admin'; // Redirect to admin page
                  } else {
                      alert('密码错误: ' + result.error);
                      document.getElementById('adminPassword').value = ''; // Clear password field
                  }
              } catch (error) {
                  console.error('Login error:', error);
                  alert('登录失败，请稍后重试');
                  document.getElementById('adminPassword').value = ''; // Clear password field
              }
          }
      </script>
  </body>
  </html>`;
}
// 生成管理员页面
async function generateAdminPage(db) {
    const config = await getConfig(db);
    // 注意：这里的 collections 数据在管理页面初次加载时并非必须，
    // 因为历史周次是通过 AJAX 动态加载的。
    // const collections = await getSongCollectionData(db); 
    return `<!DOCTYPE html>
  <html lang="zh-CN">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${config.church_name} - 管理后台</title>
      <style>
          * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
          }
          body {
              font-family: 'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
              background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
              min-height: 100vh;
              color: #333;
          }
          .admin-container {
              max-width: 1200px;
              margin: 0 auto;
              padding: 20px;
          }
          .admin-header {
              text-align: center;
              color: white;
              margin-bottom: 40px;
              padding: 30px 0;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 15px;
              backdrop-filter: blur(10px);
          }
          .admin-header h1 {
              font-size: 2.5em;
              margin-bottom: 10px;
              color: #ffd700;
          }
          .admin-header p {
              font-size: 1.1em;
              opacity: 0.9;
          }
          .admin-tabs {
              display: flex;
              justify-content: center;
              margin-bottom: 30px;
              gap: 10px;
          }
          .admin-tab-btn {
              background: rgba(255, 255, 255, 0.2);
              border: none;
              padding: 15px 30px;
              border-radius: 25px;
              color: white;
              font-size: 1.1em;
              cursor: pointer;
              transition: all 0.3s ease;
          }
          .admin-tab-btn.active {
              background: #ffd700;
              color: #1e3c72;
              font-weight: bold;
          }
          .admin-tab-content {
              background: rgba(255, 255, 255, 0.95);
              border-radius: 15px;
              padding: 30px;
              box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
              margin-bottom: 30px;
          }
          .form-group {
              margin-bottom: 20px;
          }
          .form-group label {
              display: block;
              margin-bottom: 8px;
              font-weight: bold;
              color: #2a5298;
          }
          .form-group input, .form-group textarea {
              width: 100%;
              padding: 12px;
              border: 2px solid #ddd;
              border-radius: 8px;
              font-size: 1em;
          }
          .form-group input:focus, .form-group textarea:focus {
              border-color: #2a5298;
              outline: none;
          }
          .song-item {
              background: #f8f9fa;
              border-radius: 10px;
              padding: 20px;
              margin-bottom: 15px;
          }
          .song-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 15px;
          }
          .song-title-input {
              flex: 1;
              margin-right: 15px;
          }
          .remove-song-btn {
              background: #dc3545;
              color: white;
              border: none;
              border-radius: 5px;
              padding: 8px 15px;
              cursor: pointer;
          }
          .audio-upload {
              margin-bottom: 15px;
          }
          .sheet-uploads {
              margin-top: 15px;
          }
          .sheet-preview {
              display: flex;
              flex-wrap: wrap;
              gap: 10px;
              margin-top: 10px;
              min-height: 50px; /* 避免上传中时布局跳动 */
              align-items: center;
          }
          .sheet-preview-item {
              position: relative;
              display: inline-block;
          }
          .sheet-preview-item img {
              width: 100px;
              height: 100px;
              object-fit: cover;
              border-radius: 5px;
              border: 2px solid #ddd;
              cursor: pointer;
              transition: transform 0.2s ease;
          }
          .sheet-preview-item img:hover {
              transform: scale(1.05);
          }
          .copy-tooltip {
              position: absolute;
              bottom: 110%;
              left: 50%;
              transform: translateX(-50%);
              background: rgba(0,0,0,0.8);
              color: white;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              white-space: nowrap;
              opacity: 0;
              transition: opacity 0.3s;
              pointer-events: none;
          }
          .sheet-preview-item:hover .copy-tooltip {
              opacity: 1;
          }
          .add-buttons {
              display: flex;
              gap: 15px;
              margin-bottom: 20px;
          }
          .add-song-btn, .add-sheet-btn {
              background: #28a745;
              color: white;
              border: none;
              border-radius: 8px;
              padding: 10px 20px;
              cursor: pointer;
              font-size: 1em;
          }
          .add-sheet-btn {
              background: #17a2b8;
          }
          .submit-btn {
              background: #2a5298;
              color: white;
              border: none;
              border-radius: 8px;
              padding: 15px 30px;
              cursor: pointer;
              font-size: 1.2em;
              width: 100%;
              margin-top: 20px;
          }
          .submit-btn:hover {
              background: #1e3c72;
          }
          .back-btn {
              position: fixed;
              top: 20px;
              left: 20px;
              background: rgba(255, 255, 255, 0.9);
              border: none;
              border-radius: 50px;
              padding: 10px 20px;
              cursor: pointer;
              font-size: 1em;
              color: #2a5298;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
              z-index: 1001;
          }
          .collections-list {
              background: white;
              border-radius: 10px;
              padding: 20px;
          }
          .collection-item {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 15px;
              border-bottom: 1px solid #eee;
          }
          .collection-info h3 {
              color: #2a5298;
              margin-bottom: 5px;
          }
          .collection-info p {
              color: #666;
              font-size: 0.9em;
          }
          .collection-actions {
              display: flex;
              gap: 10px;
          }
          .edit-btn, .delete-btn {
              padding: 8px 15px;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              font-size: 0.9em;
          }
          .edit-btn {
              background: #ffc107;
              color: #333;
          }
          .delete-btn {
              background: #dc3545;
              color: white;
          }
          .password-form {
              max-width: 400px;
              margin: 0 auto;
          }
          .pagination {
              display: flex;
              justify-content: center;
              margin-top: 20px;
              gap: 10px;
          }
          .pagination button {
              padding: 8px 15px;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              background: #2a5298;
              color: white;
          }
          .pagination button:disabled {
              background: #ccc;
              cursor: not-allowed;
          }
          .pagination span {
              align-self: center;
              color: #333;
          }
          @media (max-width: 768px) {
              .admin-container {
                  padding: 10px;
              }
              .admin-header h1 {
                  font-size: 2em;
              }
              .admin-tab-btn {
                  padding: 10px 20px;
                  font-size: 1em;
              }
              .admin-tab-content {
                  padding: 20px;
              }
              .song-header {
                  flex-direction: column;
                  gap: 10px;
              }
              .song-title-input {
                  margin-right: 0;
                  width: 100%;
              }
              .add-buttons {
                  flex-direction: column;
              }
              .back-btn {
                  top: 10px;
                  left: 10px;
                  padding: 8px 15px;
                  font-size: 0.9em;
              }
              .collection-item {
                  flex-direction: column;
                  gap: 15px;
                  text-align: center;
              }
              .collection-actions {
                  justify-content: center;
              }
          }
      </style>
  </head>
  <body>
      <button class="back-btn" onclick="window.location.href='/'">← 返回用户端界面</button>
      <div class="admin-container">
          <div class="admin-header">
              <h1>${config.church_name} - 管理后台</h1>
              <p>歌曲和系统设置管理</p>
          </div>
          <div class="admin-tabs">
              <button class="admin-tab-btn active" onclick="switchAdminTab('songManagement')">歌曲管理</button>
              <button class="admin-tab-btn" onclick="switchAdminTab('systemSettings')">系统设置</button>
              <button class="admin-tab-btn" onclick="switchAdminTab('collectionHistory')">历史周次</button>
          </div>
          <!-- 歌曲管理 -->
          <div class="admin-tab-content" id="songManagement">
              <form id="songForm">
                   <input type="hidden" id="collectionId" name="collectionId" value="">
                  <div class="form-group">
                      <label for="churchName">教会名称</label>
                      <input type="text" id="churchName" name="churchName" value="${config.church_name}" required>
                  </div>
                  <div class="form-group">
                      <label for="weekLabel">周次标签</label>
                      <input type="text" id="weekLabel" name="weekLabel" value="${generateWeekLabel(0)}" required>
                  </div>
                  <div id="songsContainer">
                      <!-- 歌曲项将通过JS动态添加 -->
                  </div>
                  <div class="add-buttons">
                      <button type="button" class="add-song-btn" onclick="addSong()">+ 添加歌曲</button>
                  </div>
                  <button type="submit" class="submit-btn">保存设置</button>
              </form>
          </div>
          <!-- 系统设置 -->
          <div class="admin-tab-content" id="systemSettings" style="display: none;">
              <div class="password-form">
                  <div class="form-group">
                      <label for="newPassword">新管理密码</label>
                      <input type="password" id="newPassword" name="newPassword" required>
                  </div>
                  <button class="submit-btn" onclick="savePassword()">更新密码</button>
              </div>
          </div>
          <!-- 历史周次管理 -->
          <div class="admin-tab-content" id="collectionHistory" style="display: none;">
              <h2 style="text-align: center; color: #2a5298; margin-bottom: 20px;">以往周次管理</h2>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <label><input type="checkbox" id="selectAll" onclick="toggleSelectAll()"> 全选</label>
                  <button class="delete-btn" onclick="batchDelete()">批量删除</button>
              </div>
              <div class="collections-list" id="collectionsList">
                  <p style="text-align: center; padding: 20px;">加载中...</p>
              </div>
              <div class="pagination" id="pagination">
                  <!-- 分页控件将动态添加 -->
              </div>
          </div>
      </div>
      <script>
          let songCount = 0;
          let currentPage = 1;
          let perPage = 10;
          let totalCollections = 0;

          // 初始化页面
          document.addEventListener('DOMContentLoaded', function() {
              addSong(); // 默认添加一首歌曲
          });

          // 切换管理标签页
          function switchAdminTab(tabId) {
              document.querySelectorAll('.admin-tab-content').forEach(tab => tab.style.display = 'none');
              document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
              document.getElementById(tabId).style.display = 'block';
              document.querySelector(\`[onclick="switchAdminTab('\${tabId}')"]\`).classList.add('active');
              if (tabId === 'collectionHistory') {
                  loadCollections(currentPage);
              }
          }
          
          /**
           * 【核心修改】
           * 更新歌谱预览和隐藏表单字段的函数。
           * 这个函数是所有歌谱操作的中心枢纽。
           * @param {number} songIndex - 当前操作的歌曲索引。
           * @param {HTMLInputElement|null} fileInput - 如果是由文件上传触发，则为文件输入元素。
           */
          async function updateSheetPreview(songIndex, fileInput = null) {
              const previewDiv = document.getElementById(\`sheetPreview_\${songIndex}\`);
              const sheetUrlsTextarea = document.getElementById(\`sheetUrlsTextarea_\${songIndex}\`);

              if (!previewDiv || !sheetUrlsTextarea) {
                  console.error(\`预览区域或文本框 (song \${songIndex}) 未找到。\`);
                  return;
              }

              // 步骤 1: 如果是文件上传触发，先处理上传
              if (fileInput && fileInput.files && fileInput.files.length > 0) {
                  const uploadIndicator = document.createElement('p');
                  uploadIndicator.textContent = '图片上传中，请稍候...';
                  previewDiv.appendChild(uploadIndicator);

                  const uploadedUrls = [];
                  for (const file of fileInput.files) {
                      const formData = new FormData();
                      formData.append('sheetFile', file);
                      try {
                          const response = await fetch('/admin/upload-sheet', {
                              method: 'POST',
                              body: formData
                          });
                          const result = await response.json();
                          if (result.success) {
                              uploadedUrls.push(result.imageUrl);
                          } else {
                              alert(\`文件 \${file.name} 上传失败: \${result.error}\`);
                          }
                      } catch (error) {
                          console.error('上传错误:', error);
                          alert(\`文件 \${file.name} 上传时发生网络错误。\`);
                      }
                  }
                  
                  // 步骤 2: 将上传成功的 URL 追加到 textarea 中
                  if (uploadedUrls.length > 0) {
                      const existingText = sheetUrlsTextarea.value.trim();
                      const newText = uploadedUrls.join('\\n');
                      sheetUrlsTextarea.value = existingText ? \`\${existingText}\\n\${newText}\` : newText;
                  }

                  // 清空文件选择器，以便可以再次选择相同的文件
                  fileInput.value = '';
              }
              
              // 步骤 3: 以 textarea 的内容为唯一数据源，重新生成预览和隐藏输入
              previewDiv.innerHTML = ''; // 清空预览区域

              const urlsText = sheetUrlsTextarea.value.trim();
              const finalUrls = urlsText ? urlsText.split(/\\s*\\n\\s*/).filter(url => url) : [];

              finalUrls.forEach((url, index) => {
                  if (url) {
                      // 创建图片预览项
                      const itemDiv = document.createElement('div');
                      itemDiv.className = 'sheet-preview-item';
                      
                      const img = document.createElement('img');
                      img.src = url;
                      img.alt = '歌谱预览';
                      img.onerror = function() { this.style.border = '2px solid red'; }; // 无效链接时显示红框

                      // 添加点击复制功能
                      const tooltip = document.createElement('div');
                      tooltip.className = 'copy-tooltip';
                      tooltip.textContent = '点击复制链接';
                      
                      itemDiv.appendChild(img);
                      itemDiv.appendChild(tooltip);
                      itemDiv.onclick = function(e) {
                          e.preventDefault();
                          navigator.clipboard.writeText(url).then(() => {
                              tooltip.textContent = '已复制!';
                              setTimeout(() => { tooltip.textContent = '点击复制链接'; }, 2000);
                          }).catch(err => {
                              console.error('复制失败:', err);
                              alert('复制失败');
                          });
                      };

                      previewDiv.appendChild(itemDiv);

                      // 创建对应的隐藏表单字段，用于提交
                      const hiddenInput = document.createElement('input');
                      hiddenInput.type = 'hidden';
                      hiddenInput.name = \`song_\${songIndex}_sheet_\${index}\`;
                      hiddenInput.value = url;
                      previewDiv.appendChild(hiddenInput); // 放在预览区，便于调试
                  }
              });
          }


          // 添加歌曲
          function addSong() {
              const songsContainer = document.getElementById('songsContainer');
              const songDiv = document.createElement('div');
              songDiv.className = 'song-item';
              const currentSongIndex = songCount;
              const sheetTextareaId = \`sheetUrlsTextarea_\${currentSongIndex}\`;
              
              songDiv.innerHTML = \`
                  <div class="song-header">
                      <input type="text" class="song-title-input" name="song_\${currentSongIndex}_title" placeholder="歌曲名称" required>
                      <button type="button" class="remove-song-btn" onclick="this.parentElement.parentElement.remove()">删除</button>
                  </div>
                  <div class="form-group">
                      <label>音频文件 (上传或粘贴链接)</label>
                      <div style="display: flex; gap: 10px; margin-top: 5px;">
                          <button type="button" class="add-song-btn" style="width: auto; flex-shrink: 0;" onclick="document.getElementById('audioFile_\${currentSongIndex}').click()">上传音频</button>
                          <input type="file" id="audioFile_\${currentSongIndex}" name="audioFile" style="display: none;" accept="audio/*" onchange="handleAudioUpload(this, \${currentSongIndex})">
                          <input type="url" name="song_\${currentSongIndex}_audioUrl" placeholder="或在此处粘贴音频链接" style="flex: 1;">
                      </div>
                  </div>
                  <div class="form-group">
                      <label>
                          <input type="checkbox" name="song_\${currentSongIndex}_visible" checked> 显示这首歌曲
                      </label>
                  </div>
                  <div class="sheet-uploads">
                      <label>歌谱 (上传或粘贴链接，每行一个)</label>
                      <div style="display: flex; gap: 10px; margin-top: 5px;">
                          <button type="button" class="add-sheet-btn" style="width: auto; flex-shrink: 0;" onclick="document.getElementById('sheetFile_\${currentSongIndex}').click()">上传图片</button>
                          <input type="file" id="sheetFile_\${currentSongIndex}" name="sheetFile" style="display: none;" multiple accept="image/*" onchange="updateSheetPreview(\${currentSongIndex}, this)">
                          <textarea id="\${sheetTextareaId}" placeholder="在此粘贴图片链接，每行一个" style="flex: 1; height: 100px; resize: vertical;"></textarea>
                      </div>
                      <div class="sheet-preview" id="sheetPreview_\${currentSongIndex}"></div>
                  </div>
              \`;
              
              songsContainer.appendChild(songDiv);

              // 为新添加的 textarea 添加事件监听器，实现实时更新预览
              const newSheetTextarea = document.getElementById(sheetTextareaId);
              if (newSheetTextarea) {
                  let debounceTimer;
                  const handleInput = () => {
                      clearTimeout(debounceTimer);
                      debounceTimer = setTimeout(() => {
                          updateSheetPreview(currentSongIndex);
                      }, 300); // 防抖，避免输入时频繁刷新
                  };
                  newSheetTextarea.addEventListener('input', handleInput);
                  newSheetTextarea.addEventListener('paste', handleInput);
              }

              songCount++;
          }

          // 处理音频上传
          async function handleAudioUpload(input, songIndex) {
              const file = input.files[0];
              if (!file) return;
              const audioUrlInput = document.querySelector(\`[name="song_\${songIndex}_audioUrl"]\`);
              audioUrlInput.placeholder = '上传中，请稍候...';
              audioUrlInput.value = '';
              const formData = new FormData();
              formData.append('audioFile', file);
              try {
                  const response = await fetch('/admin/upload-audio', {
                      method: 'POST',
                      body: formData
                  });
                  const result = await response.json();
                  if (result.success) {
                      audioUrlInput.value = result.audioUrl;
                      audioUrlInput.placeholder = '或在此处粘贴音频链接';
                  } else {
                      alert('音频上传失败: ' + result.error);
                      audioUrlInput.placeholder = '上传失败，请重试或粘贴链接';
                  }
              } catch (error) {
                  console.error('Audio upload error:', error);
                  alert('音频上传失败');
                  audioUrlInput.placeholder = '上传失败，请重试或粘贴链接';
              }
          }

          // 提交表单
          document.getElementById('songForm').addEventListener('submit', async function(e) {
              e.preventDefault();
              const formData = new FormData(this);
              // 注意：collectionId 是在 editCollection 时设置的，
              // 现在通过一个隐藏 input 来处理，更标准。
              
              const submitButton = this.querySelector('.submit-btn');
              submitButton.textContent = '保存中...';
              submitButton.disabled = true;

              try {
                  const response = await fetch('/admin/save', {
                      method: 'POST',
                      body: formData
                  });
                  const result = await response.json();
                  if (result.success) {
                      alert('保存成功！');
                      document.getElementById('collectionId').value = result.collectionId; // 更新当前页面的 collectionId
                  } else {
                      alert('保存失败: ' + result.error);
                  }
              } catch (error) {
                  console.error('Save error:', error);
                  alert('保存时发生网络错误');
              } finally {
                  submitButton.textContent = '保存设置';
                  submitButton.disabled = false;
              }
          });

          // 保存密码
          async function savePassword() {
              const newPassword = document.getElementById('newPassword').value;
              if (!newPassword) {
                  alert('请输入新密码');
                  return;
              }
              const formData = new FormData();
              formData.append('newPassword', newPassword);
              try {
                  const response = await fetch('/admin/save-password', {
                      method: 'POST',
                      body: formData
                  });
                  const result = await response.json();
                  if (result.success) {
                      alert('密码更新成功！');
                      document.getElementById('newPassword').value = '';
                  } else {
                      alert('密码更新失败: ' + result.error);
                  }
              } catch (error) {
                  console.error('Password save error:', error);
                  alert('密码更新失败');
              }
          }

          // 加载集合列表（分页）
          async function loadCollections(page = 1) {
              const collectionsList = document.getElementById('collectionsList');
              collectionsList.innerHTML = '<p style="text-align: center; padding: 20px;">加载中...</p>';
              try {
                  const response = await fetch(\`/admin/collections?page=\${page}&perPage=\${perPage}\`);
                  const result = await response.json();
                  if (result.success && result.collections.length > 0) {
                      collectionsList.innerHTML = result.collections.map(collection => \`
                          <div class="collection-item">
                              <input type="checkbox" class="collection-checkbox" value="\${collection.id}" style="margin-right: 15px;">
                              <div class="collection-info" style="flex-grow: 1;">
                                  <h3>\${collection.collection_name}</h3>
                                  <p>周次标签: \${collection.collection_week_label} | 发布日期: \${collection.publish_date}</p>
                              </div>
                              <div class="collection-actions">
                                  <button class="edit-btn" onclick="editCollection('\${collection.id}')">编辑</button>
                                  <button class="delete-btn" onclick="deleteCollection('\${collection.id}', '\${collection.collection_name}')">删除</button>
                              </div>
                          </div>
                      \`).join('');
                      totalCollections = result.total;
                      currentPage = result.page;
                      updatePagination();
                  } else {
                      collectionsList.innerHTML = '<p style="text-align: center; padding: 20px;">暂无历史周次数据</p>';
                      document.getElementById('pagination').innerHTML = ''; // 清空分页
                  }
              } catch (error) {
                  console.error('Load collections error:', error);
                  collectionsList.innerHTML = '<p style="text-align: center; padding: 20px; color: red;">加载失败</p>';
              }
          }

          // 更新分页控件
          function updatePagination() {
              const pagination = document.getElementById('pagination');
              const totalPages = Math.ceil(totalCollections / perPage);
              if (totalPages <= 1) {
                  pagination.innerHTML = '';
                  return;
              }
              pagination.innerHTML = \`
                  <button onclick="loadCollections(\${currentPage - 1})" \${currentPage === 1 ? 'disabled' : ''}>上一页</button>
                  <span>第 \${currentPage} / \${totalPages} 页</span>
                  <button onclick="loadCollections(\${currentPage + 1})" \${currentPage >= totalPages ? 'disabled' : ''}>下一页</button>
              \`;
          }

          // 全选/取消全选
          function toggleSelectAll() {
              const selectAll = document.getElementById('selectAll');
              document.querySelectorAll('.collection-checkbox').forEach(checkbox => {
                  checkbox.checked = selectAll.checked;
              });
          }

          // 批量删除
          async function batchDelete() {
              const selectedIds = Array.from(document.querySelectorAll('.collection-checkbox:checked')).map(checkbox => checkbox.value);
              if (selectedIds.length === 0) {
                  alert('请选择要删除的周次');
                  return;
              }
              if (!confirm(\`确定要删除选中的 \${selectedIds.length} 个周次吗？此操作不可恢复！\`)) {
                  return;
              }
              const formData = new FormData();
              formData.append('ids', JSON.stringify(selectedIds));
              try {
                  const response = await fetch('/admin/delete-multiple', {
                      method: 'POST',
                      body: formData
                  });
                  const result = await response.json();
                  if (result.success) {
                      alert('批量删除成功！');
                      loadCollections(1); // 删除后返回第一页
                  } else {
                      alert('批量删除失败: ' + result.error);
                  }
              } catch (error) {
                  console.error('Batch delete error:', error);
                  alert('批量删除失败');
              }
          }

          // 编辑集合
          async function editCollection(collectionId) {
              try {
                  const response = await fetch(\`/admin/edit/\${collectionId}\`);
                  const result = await response.json();
                  if (result.success) {
                      switchAdminTab('songManagement'); // 切换到歌曲管理标签页
                      
                      const collection = result.collection;
                      document.getElementById('collectionId').value = collectionId;
                      document.getElementById('churchName').value = '${config.church_name}'; // 教会名保持当前配置
                      document.getElementById('weekLabel').value = collection.collection_week_label;
                      
                      // 清空并重建歌曲列表
                      document.getElementById('songsContainer').innerHTML = '';
                      songCount = 0;
                      
                      if (collection.songs && collection.songs.length > 0) {
                        collection.songs.forEach((song, index) => {
                            addSong();
                            // 注意：addSong会自增songCount，所以要用index来定位刚添加的元素
                            document.querySelector(\`[name="song_\${index}_title"]\`).value = song.title;
                            document.querySelector(\`[name="song_\${index}_audioUrl"]\`).value = song.audio_url || '';
                            document.querySelector(\`[name="song_\${index}_visible"]\`).checked = song.visible;
                            
                            // 填充歌谱链接并触发预览更新
                            if (song.sheets && song.sheets.length > 0) {
                                const sheetUrlsTextarea = document.getElementById(\`sheetUrlsTextarea_\${index}\`);
                                if (sheetUrlsTextarea) {
                                    sheetUrlsTextarea.value = song.sheets.map(s => s.image_url).join('\\n');
                                    updateSheetPreview(index); // 异步更新预览
                                }
                            }
                        });
                      } else {
                          addSong(); // 如果没有歌曲，则添加一个空的
                      }
                      
                      window.scrollTo(0, 0); // 滚动到页面顶部
                      alert('已加载选中的周次数据，请修改后保存。');
                  } else {
                      alert('加载编辑数据失败: ' + result.error);
                  }
              } catch (error) {
                  console.error('Edit collection error:', error);
                  alert('加载编辑数据失败');
              }
          }

          // 删除集合
          async function deleteCollection(collectionId, collectionName) {
             if (!confirm(\`确定要删除周次 "\${collectionName}" 吗？此操作不可恢复！\`)) {
                  return;
              }
              try {
                  const response = await fetch(\`/admin/delete/\${collectionId}\`, {
                      method: 'DELETE'
                  });
                  const result = await response.json();
                  if (result.success) {
                      alert('删除成功！');
                      loadCollections(currentPage); // 重新加载当前页
                  } else {
                      alert('删除失败: ' + result.error);
                  }
              } catch (error) {
                  console.error('Delete collection error:', error);
                  alert('删除失败');
              }
          }
      </script>
  </body>
  </html>`;
}
