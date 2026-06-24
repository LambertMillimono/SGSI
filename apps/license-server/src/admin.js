/**
 * CLI Admin Tool — SGSI License Server
 * Usage: node src/admin.js <command> [options]
 *
 * Commands:
 *   generate --plan PRO --year 2027 --school "École XYZ" --email client@email.com
 *   list
 *   revoke --key SGSI-PRO-XXXXXXXX-2027
 *   reactivate --key SGSI-PRO-XXXXXXXX-2027 --year 2028
 */

const https  = require('https')
const http   = require('http')

const SERVER  = process.env.LICENSE_SERVER || 'http://localhost:3500'
const SECRET  = process.env.ADMIN_SECRET   || 'sgsi-admin-secret-change-me'

function parseArgs() {
  const args   = process.argv.slice(2)
  const cmd    = args[0]
  const opts   = {}
  for (let i = 1; i < args.length; i += 2) {
    if (args[i].startsWith('--')) {
      opts[args[i].slice(2)] = args[i + 1]
    }
  }
  return { cmd, opts }
}

async function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const url     = new URL(SERVER + path)
    const isHttps = url.protocol === 'https:'
    const mod     = isHttps ? https : http

    const data = JSON.stringify(body)
    const opts = {
      hostname: url.hostname,
      port:     url.port || (isHttps ? 443 : 80),
      path:     url.pathname + url.search,
      method,
      headers:  {
        'Content-Type':    'application/json',
        'Content-Length':  Buffer.byteLength(data),
        'x-admin-secret': SECRET,
      },
    }

    const req = mod.request(opts, (res) => {
      let body = ''
      res.on('data', c => body += c)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }) }
        catch { resolve({ status: res.statusCode, data: body }) }
      })
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

async function main() {
  const { cmd, opts } = parseArgs()

  if (!cmd) {
    console.log(`
SGSI License Admin CLI
======================
Usage: node src/admin.js <command> [options]

Commands:
  generate  --plan PRO --year 2027 --school "École XYZ" --email admin@ecole.com
  list
  revoke    --key SGSI-PRO-XXXXXXXX-2027
  reactivate --key SGSI-PRO-XXXXXXXX-2027 --year 2028

Plans: STD (500 élèves) | PRO (2000 élèves) | ULT (illimité)
    `)
    return
  }

  if (cmd === 'generate') {
    const res = await apiCall('POST', '/api/license/generate', {
      plan:          opts.plan        || 'STD',
      expiryYear:    parseInt(opts.year || new Date().getFullYear() + 1),
      schoolName:    opts.school      || '',
      customerEmail: opts.email       || '',
      notes:         opts.notes       || '',
    })
    if (res.status === 201) {
      console.log('\n✅ Licence générée avec succès !\n')
      console.log(`  Clé       : \x1b[32m${res.data.key}\x1b[0m`)
      console.log(`  Plan      : ${res.data.plan} (max ${res.data.maxStudents} élèves)`)
      console.log(`  École     : ${res.data.schoolName || '(non définie)'}`)
      console.log(`  Expire    : ${new Date(res.data.expiresAt).toLocaleDateString('fr-FR')}\n`)
      console.log(`  📋 Commande d'activation (à donner au client):`)
      console.log(`     Allez dans Paramètres → Licence et entrez : ${res.data.key}\n`)
    } else {
      console.error('❌ Erreur:', res.data.error || JSON.stringify(res.data))
    }
    return
  }

  if (cmd === 'list') {
    const res = await apiCall('GET', '/api/license/list', {})
    const d   = res.data
    console.log(`\n📊 Licences SGSI — ${d.total} total (${d.active} actives, ${d.expired} expirées, ${d.revoked} révoquées)\n`)
    console.log('  CLÉ                              PLAN  ÉCOLE                    STATUT      EXPIRE')
    console.log('  ' + '─'.repeat(90))
    for (const l of d.licenses) {
      const status  = !l.isActive ? '❌ Révoquée'
                    : l.expired   ? '⚠️  Expirée '
                    : '✅ Active  '
      const expDate = l.expiresAt ? new Date(l.expiresAt).toLocaleDateString('fr-FR') : 'Permanent'
      const school  = (l.schoolName || '—').padEnd(24).slice(0, 24)
      console.log(`  ${l.key.padEnd(32)} ${l.plan.padEnd(5)} ${school} ${status}  ${expDate}`)
    }
    console.log()
    return
  }

  if (cmd === 'revoke') {
    if (!opts.key) { console.error('❌ --key requis'); return }
    const res = await apiCall('POST', '/api/license/revoke', { key: opts.key })
    if (res.status === 200) {
      console.log(`✅ Licence ${opts.key} révoquée. Le client ne pourra plus se connecter.`)
    } else {
      console.error('❌ Erreur:', res.data.error)
    }
    return
  }

  if (cmd === 'reactivate') {
    if (!opts.key) { console.error('❌ --key requis'); return }
    const res = await apiCall('POST', '/api/license/reactivate', {
      key:          opts.key,
      newExpiryYear: opts.year ? parseInt(opts.year) : undefined,
    })
    if (res.status === 200) {
      console.log(`✅ Licence ${opts.key} réactivée.`)
    } else {
      console.error('❌ Erreur:', res.data.error)
    }
    return
  }

  console.error(`❌ Commande inconnue: ${cmd}`)
}

main().catch(console.error)
