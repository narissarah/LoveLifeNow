const { verifyAuth, unauthorizedResponse } = require('./utils/auth');
const { getPool, initDb } = require('./utils/db');

exports.handler = async (event) => {
  if (!verifyAuth(event)) {
    return unauthorizedResponse();
  }

  const headers = { 'Content-Type': 'application/json' };

  try {
    await initDb();
    const sql = getPool();

    // GET — fetch statuses for a form type
    if (event.httpMethod === 'GET') {
      const formType = (event.queryStringParameters || {}).formType;
      if (!formType) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'formType required' }) };
      }

      const rows = await sql`
        SELECT submission_id, is_read, is_archived, is_deleted, notes
        FROM submission_status
        WHERE form_type = ${formType}
      `;

      const statusMap = {};
      rows.forEach(r => {
        statusMap[r.submission_id] = {
          read: r.is_read,
          archived: r.is_archived,
          deleted: r.is_deleted,
          notes: r.notes || ''
        };
      });

      return { statusCode: 200, headers, body: JSON.stringify({ statusMap }) };
    }

    // POST — update statuses
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { id, ids, formType, action, notes } = body;

      if (!formType || !action) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'formType and action required' }) };
      }

      // Determine which IDs to process
      const targetIds = ids || (id ? [id] : []);
      if (targetIds.length === 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id or ids required' }) };
      }

      // Build the update based on action
      const actionMap = {
        read:      { is_read: true },
        unread:    { is_read: false },
        archive:   { is_archived: true },
        unarchive: { is_archived: false },
        delete:    { is_deleted: true },
        restore:   { is_deleted: false },
      };

      if (action === 'notes') {
        // Notes update — single ID only
        const targetId = targetIds[0];
        await sql`
          INSERT INTO submission_status (submission_id, form_type, notes, updated_at)
          VALUES (${String(targetId)}, ${formType}, ${notes || ''}, NOW())
          ON CONFLICT (submission_id) DO UPDATE
          SET notes = ${notes || ''}, updated_at = NOW()
        `;
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }

      const updates = actionMap[action];
      if (!updates) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid action', validActions: [...Object.keys(actionMap), 'notes'] }) };
      }

      // Upsert each target ID
      for (const targetId of targetIds) {
        const sid = String(targetId);
        if (action === 'read' || action === 'unread') {
          await sql`
            INSERT INTO submission_status (submission_id, form_type, is_read, updated_at)
            VALUES (${sid}, ${formType}, ${updates.is_read}, NOW())
            ON CONFLICT (submission_id) DO UPDATE
            SET is_read = ${updates.is_read}, updated_at = NOW()
          `;
        } else if (action === 'archive' || action === 'unarchive') {
          await sql`
            INSERT INTO submission_status (submission_id, form_type, is_archived, updated_at)
            VALUES (${sid}, ${formType}, ${updates.is_archived}, NOW())
            ON CONFLICT (submission_id) DO UPDATE
            SET is_archived = ${updates.is_archived}, updated_at = NOW()
          `;
        } else if (action === 'delete' || action === 'restore') {
          await sql`
            INSERT INTO submission_status (submission_id, form_type, is_deleted, updated_at)
            VALUES (${sid}, ${formType}, ${updates.is_deleted}, NOW())
            ON CONFLICT (submission_id) DO UPDATE
            SET is_deleted = ${updates.is_deleted}, updated_at = NOW()
          `;
        }
      }

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, updated: targetIds.length }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (error) {
    console.error('submission-actions error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error', details: error.message }) };
  }
};
