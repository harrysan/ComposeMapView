import { describe, expect, it } from 'vitest'
import { rules, runRules } from '@/core/rules'
import type { Issue } from '@/core/rules'
import { model } from './helpers'

/** Jalankan satu aturan pada YAML. */
function check(ruleId: string, yaml: string): Issue[] {
  const rule = rules.find((r) => r.id === ruleId)
  if (!rule) throw new Error(`Aturan ${ruleId} tidak ada`)
  return rule.check(model(yaml))
}

describe('registry', () => {
  it('berisi semua aturan SPEC §7.1 dengan id unik', () => {
    const ids = rules.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.sort()).toEqual(
      [
        'CFG001',
        'CFG002',
        'CFG003',
        'PORT001',
        'NET001',
        'NET002',
        'NET003',
        'NET004',
        'NET005',
        'DEP001',
        'DEP002',
        'DEP003',
        'VOL001',
        'VOL002',
        'IMG001',
        'SEC001',
        'SEC002',
        'VAR001',
      ].sort(),
    )
  })

  it('setiap issue memakai id dan severity aturannya', () => {
    const m = model('version: "3"\nservices:\n  a:\n    ports: ["80:80", "80:80"]\n')
    for (const issue of runRules(m)) {
      const rule = rules.find((r) => r.id === issue.ruleId)!
      expect(issue.severity).toBe(rule.severity)
    }
  })

  it('runRules mengurutkan error → warning → info, lalu baris', () => {
    const m = model(`version: "3"
services:
  a:
    image: redis
  b:
    image: x:1
    depends_on: [nope]
  c:
    image: y:1
    depends_on: [ghost]
`)
    const issues = runRules(m)
    expect(issues.map((i) => i.ruleId)).toEqual(['DEP001', 'DEP001', 'IMG001', 'CFG002'])
    expect(issues[0]!.source!.startLine).toBeLessThan(issues[1]!.source!.startLine)
  })
})

describe('CFG001 tanpa image/build', () => {
  it('positif', () => {
    const [i] = check('CFG001', 'services:\n  worker:\n    command: run\n')
    expect(i).toMatchObject({
      message: 'Service "worker" tidak punya image atau build.',
      services: ['worker'],
    })
    expect(i!.source).toEqual({ startLine: 2, endLine: 3 })
  })
  it('negatif: image, build, atau extends', () => {
    expect(
      check(
        'CFG001',
        'services:\n  a:\n    image: x\n  b:\n    build: .\n  c:\n    extends:\n      file: base.yml\n      service: a\n',
      ),
    ).toEqual([])
  })
})

describe('CFG002 version usang', () => {
  it('positif', () => {
    expect(check('CFG002', 'version: "3.8"\nservices: {}\n')).toEqual([
      expect.objectContaining({ source: { startLine: 1, endLine: 1 } }),
    ])
  })
  it('negatif', () => {
    expect(check('CFG002', 'services: {}\n')).toEqual([])
  })
})

describe('CFG003 network_mode host + ports', () => {
  it('positif', () => {
    const [i] = check(
      'CFG003',
      'services:\n  nginx:\n    image: x\n    network_mode: host\n    ports: ["80:80"]\n',
    )
    expect(i?.message).toBe('Port di "nginx" diabaikan karena network_mode: host.')
  })
  it('negatif: host tanpa ports, atau ports tanpa host', () => {
    expect(
      check(
        'CFG003',
        'services:\n  a:\n    image: x\n    network_mode: host\n  b:\n    image: x\n    ports: [80]\n',
      ),
    ).toEqual([])
  })
})

describe('PORT001 port host bentrok', () => {
  const svc = (name: string, ports: string) => `  ${name}:\n    image: x\n    ports: [${ports}]\n`

  it('positif: port sama di dua service', () => {
    const issues = check(
      'PORT001',
      'services:\n' + svc('web', '"8080:80"') + svc('admin', '"8080:8080"'),
    )
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      message: 'Port host 8080/tcp dipakai oleh "web" dan "admin".',
      services: ['web', 'admin'],
      source: { startLine: 7, endLine: 7 },
    })
  })

  it('positif: rentang beririsan', () => {
    const [i] = check(
      'PORT001',
      'services:\n' + svc('a', '"9000-9002:9000-9002"') + svc('b', '"9001:9001"'),
    )
    expect(i?.message).toContain('Port host 9001/tcp')
  })

  it('positif: dua kali di service yang sama', () => {
    const [i] = check('PORT001', 'services:\n' + svc('a', '"80:80", "80:81"'))
    expect(i).toMatchObject({
      message: 'Port host 80/tcp dipakai dua kali oleh "a".',
      services: ['a'],
    })
  })

  it('positif: 0.0.0.0 beririsan dengan IP spesifik', () => {
    expect(
      check('PORT001', 'services:\n' + svc('a', '"127.0.0.1:80:80"') + svc('b', '"80:80"')),
    ).toHaveLength(1)
    expect(
      check('PORT001', 'services:\n' + svc('a', '"[::]:80:80"') + svc('b', '"10.0.0.1:80:80"')),
    ).toHaveLength(1)
  })

  it('negatif: protokol berbeda', () => {
    expect(
      check('PORT001', 'services:\n' + svc('a', '"53:53/udp"') + svc('b', '"53:53/tcp"')),
    ).toEqual([])
  })

  it('negatif: host IP spesifik yang berbeda', () => {
    expect(
      check(
        'PORT001',
        'services:\n' + svc('a', '"127.0.0.1:80:80"') + svc('b', '"127.0.0.2:80:80"'),
      ),
    ).toEqual([])
  })

  it('negatif: rentang bersebelahan, port acak, variabel tak ter-resolve', () => {
    expect(
      check('PORT001', 'services:\n' + svc('a', '"8000-8001:80-81"') + svc('b', '"8002:80"')),
    ).toEqual([])
    expect(check('PORT001', 'services:\n' + svc('a', '"80"') + svc('b', '"80"'))).toEqual([])
    expect(check('PORT001', 'services:\n' + svc('a', '"${P}:80"') + svc('b', '"${P}:80"'))).toEqual(
      [],
    )
  })

  it('negatif: network_mode host dilewati', () => {
    const yaml =
      'services:\n  a:\n    image: x\n    network_mode: host\n    ports: ["80:80"]\n' +
      svc('b', '"80:80"')
    expect(check('PORT001', yaml)).toEqual([])
  })
})

describe('NET001 subnet tumpang tindih', () => {
  const net = (name: string, subnet: string, extra = '') =>
    `  ${name}:\n${extra}    ipam:\n      config:\n        - subnet: ${subnet}\n`

  it('positif', () => {
    const [i] = check(
      'NET001',
      'networks:\n' + net('backend', '172.20.0.0/16') + net('db', '172.20.5.0/24'),
    )
    expect(i).toMatchObject({
      message: 'Subnet 172.20.0.0/16 (backend) tumpang tindih dengan 172.20.5.0/24 (db).',
      networks: ['backend', 'db'],
    })
  })

  it('negatif: bersebelahan, IPv6, variabel, external', () => {
    expect(
      check('NET001', 'networks:\n' + net('a', '10.0.0.0/24') + net('b', '10.0.1.0/24')),
    ).toEqual([])
    expect(check('NET001', 'networks:\n' + net('a', 'fd00::/64') + net('b', 'fd00::/48'))).toEqual(
      [],
    )
    expect(check('NET001', 'networks:\n' + net('a', '${SUB}') + net('b', '10.0.0.0/8'))).toEqual([])
    expect(
      check(
        'NET001',
        'networks:\n' + net('a', '10.0.0.0/8', '    external: true\n') + net('b', '10.0.0.0/8'),
      ),
    ).toEqual([])
  })
})

describe('NET002 network tidak dideklarasikan', () => {
  it('positif', () => {
    const [i] = check('NET002', 'services:\n  app:\n    image: x\n    networks: [cache]\n')
    expect(i).toMatchObject({
      message: 'Network "cache" dipakai "app" tapi tidak dideklarasikan.',
      networks: ['cache'],
      source: { startLine: 4, endLine: 4 },
    })
  })
  it('negatif: dideklarasikan, atau default implisit', () => {
    expect(
      check(
        'NET002',
        'services:\n  app:\n    image: x\n    networks: [cache]\nnetworks:\n  cache:\n',
      ),
    ).toEqual([])
    expect(check('NET002', 'services:\n  app:\n    image: x\n')).toEqual([])
    expect(check('NET002', 'services:\n  app:\n    image: x\n    networks: [default]\n')).toEqual(
      [],
    )
  })
})

const staticIp = (ip: string, subnet?: string, svc = 'db') => `services:
  ${svc}:
    image: x
    networks:
      back:
        ipv4_address: ${ip}
networks:
  back:
${subnet ? `    ipam:\n      config:\n        - subnet: ${subnet}\n` : ''}`

describe('NET003 IP di luar subnet', () => {
  it('positif', () => {
    const [i] = check('NET003', staticIp('10.0.1.5', '172.20.0.0/24'))
    expect(i?.message).toBe('IP 10.0.1.5 milik "db" berada di luar subnet 172.20.0.0/24.')
  })
  it('negatif: di dalam subnet, tanpa subnet, IP variabel', () => {
    expect(check('NET003', staticIp('172.20.0.5', '172.20.0.0/24'))).toEqual([])
    expect(check('NET003', staticIp('10.0.1.5'))).toEqual([])
    expect(check('NET003', staticIp('${IP}', '172.20.0.0/24'))).toEqual([])
  })
})

describe('NET004 IP ganda', () => {
  const yaml = (ip2: string) => `services:
  a:
    image: x
    networks:
      back: { ipv4_address: 10.0.0.5 }
  b:
    image: x
    networks:
      back: { ipv4_address: ${ip2} }
networks:
  back:
`
  it('positif', () => {
    const [i] = check('NET004', yaml('10.0.0.5'))
    expect(i).toMatchObject({
      services: ['a', 'b'],
      message: 'IP 10.0.0.5 dipakai "a" dan "b" di network "back".',
    })
  })
  it('negatif', () => {
    expect(check('NET004', yaml('10.0.0.6'))).toEqual([])
  })
})

describe('NET005 static IP tanpa subnet', () => {
  it('positif', () => {
    expect(check('NET005', staticIp('10.0.0.5'))[0]?.message).toBe(
      'Static IP butuh ipam.config.subnet di network "back".',
    )
  })
  it('negatif', () => {
    expect(check('NET005', staticIp('10.0.0.5', '10.0.0.0/24'))).toEqual([])
  })
})

describe('DEP001 dependensi tidak ada', () => {
  it('positif', () => {
    const [i] = check('DEP001', 'services:\n  app:\n    image: x\n    depends_on: [dbb]\n')
    expect(i?.message).toBe('"app" bergantung pada "dbb", tapi service itu tidak ada.')
  })
  it('negatif', () => {
    expect(
      check(
        'DEP001',
        'services:\n  app:\n    image: x\n    depends_on: [db]\n  db:\n    image: y\n',
      ),
    ).toEqual([])
  })
})

describe('DEP002 dependensi melingkar', () => {
  it('positif: dua service', () => {
    const issues = check(
      'DEP002',
      'services:\n  app:\n    image: x\n    depends_on: [worker]\n  worker:\n    image: x\n    depends_on: [app]\n',
    )
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      message: 'Dependensi melingkar: app → worker → app.',
      services: ['app', 'worker'],
      source: { startLine: 4, endLine: 4 },
    })
  })
  it('positif: tiga service dan diri sendiri', () => {
    const issues = check(
      'DEP002',
      `services:
  a: { image: x, depends_on: [b] }
  b: { image: x, depends_on: [c] }
  c: { image: x, depends_on: [a] }
  d: { image: x, depends_on: [d] }
`,
    )
    expect(issues.map((i) => i.message)).toEqual([
      'Dependensi melingkar: a → b → c → a.',
      'Dependensi melingkar: d → d.',
    ])
  })
  it('negatif: diamond bukan siklus', () => {
    expect(
      check(
        'DEP002',
        `services:
  a: { image: x, depends_on: [b, c] }
  b: { image: x, depends_on: [d] }
  c: { image: x, depends_on: [d] }
  d: { image: x }
`,
      ),
    ).toEqual([])
  })
})

describe('DEP003 service_healthy tanpa healthcheck', () => {
  const yaml = (dbExtra: string) => `services:
  app:
    image: x
    depends_on:
      db:
        condition: service_healthy
  db:
    image: y
${dbExtra}`
  it('positif: tanpa healthcheck atau disable', () => {
    expect(check('DEP003', yaml(''))[0]?.message).toBe(
      '"app" menunggu "db" sehat, tapi "db" tidak punya healthcheck.',
    )
    expect(check('DEP003', yaml('    healthcheck:\n      disable: true\n'))).toHaveLength(1)
  })
  it('negatif: punya healthcheck, atau condition lain', () => {
    expect(check('DEP003', yaml('    healthcheck:\n      test: ["CMD", "true"]\n'))).toEqual([])
    expect(
      check(
        'DEP003',
        'services:\n  app:\n    image: x\n    depends_on: [db]\n  db:\n    image: y\n',
      ),
    ).toEqual([])
  })
})

describe('VOL001 / VOL002', () => {
  it('VOL001 positif', () => {
    const [i] = check(
      'VOL001',
      'services:\n  db:\n    image: x\n    volumes: ["data:/var/lib/mysql"]\n',
    )
    expect(i).toMatchObject({
      message: 'Volume "data" dipakai "db" tapi tidak dideklarasikan.',
      volumes: ['data'],
    })
  })
  it('VOL001 negatif: dideklarasikan, bind, anonim', () => {
    expect(
      check(
        'VOL001',
        'services:\n  db:\n    image: x\n    volumes: ["data:/d", "./x:/x", "/anon"]\nvolumes:\n  data:\n',
      ),
    ).toEqual([])
  })
  it('VOL002 positif', () => {
    const [i] = check('VOL002', 'services:\n  a:\n    image: x\nvolumes:\n  cache:\n')
    expect(i).toMatchObject({ volumes: ['cache'], source: { startLine: 5, endLine: 5 } })
  })
  it('VOL002 negatif', () => {
    expect(
      check(
        'VOL002',
        'services:\n  a:\n    image: x\n    volumes: ["cache:/c"]\nvolumes:\n  cache:\n',
      ),
    ).toEqual([])
  })
})

describe('IMG001 image tanpa tag', () => {
  it('positif: tanpa tag dan latest', () => {
    expect(check('IMG001', 'services:\n  r:\n    image: redis\n')[0]?.message).toBe(
      'Image "redis" tanpa tag; versi bisa berubah sewaktu-waktu.',
    )
    expect(check('IMG001', 'services:\n  r:\n    image: redis:latest\n')[0]?.message).toContain(
      'latest',
    )
    expect(check('IMG001', 'services:\n  r:\n    image: registry:5000/app\n')).toHaveLength(1)
  })
  it('negatif: tag, digest, build, variabel', () => {
    expect(
      check(
        'IMG001',
        `services:
  a: { image: "redis:7" }
  b: { image: "app@sha256:abc" }
  c: { image: myapp, build: . }
  d: { image: "nginx:\${TAG}" }
  e: { image: "registry:5000/app:1.0" }
`,
      ),
    ).toEqual([])
  })
})

describe('SEC001 rahasia literal', () => {
  it('positif', () => {
    const [i] = check(
      'SEC001',
      'services:\n  db:\n    image: x\n    environment:\n      MYSQL_ROOT_PASSWORD: secret\n',
    )
    expect(i).toMatchObject({
      message: 'MYSQL_ROOT_PASSWORD di "db" ditulis langsung di file.',
      source: { startLine: 5, endLine: 5 },
    })
    expect(
      check(
        'SEC001',
        'services:\n  a:\n    image: x\n    environment:\n      - API_KEY=x\n      - GITHUB_TOKEN=y\n      - DB_PASSWD=z\n',
      ),
    ).toHaveLength(3)
  })
  it('negatif: variabel, kosong, dari shell, *_FILE, key biasa', () => {
    expect(
      check(
        'SEC001',
        `services:
  a:
    image: x
    environment:
      - PASSWORD=\${DB_PASS}
      - SECRET=\${S:-dev}
      - TOKEN=
      - API_KEY
      - MYSQL_ROOT_PASSWORD_FILE=/run/secrets/pw
      - DB_HOST=db
`,
      ),
    ).toEqual([])
  })
})

describe('SEC002 port database terbuka', () => {
  it('positif', () => {
    const [i] = check('SEC002', 'services:\n  db:\n    image: x\n    ports: ["3306:3306"]\n')
    expect(i?.message).toBe('Port 3306 (MySQL) "db" terbuka ke semua interface.')
    expect(i?.hint).toContain('127.0.0.1:3306:3306')
    expect(
      check('SEC002', 'services:\n  db:\n    image: x\n    ports: ["15432:5432"]\n'),
    ).toHaveLength(1)
  })
  it('negatif: 127.0.0.1, port lain, tidak dipublish', () => {
    expect(
      check(
        'SEC002',
        'services:\n  db:\n    image: x\n    ports: ["127.0.0.1:3306:3306", "8080:80", "5432"]\n',
      ),
    ).toEqual([])
  })
})

describe('VAR001 variabel tak ter-resolve', () => {
  it('positif: satu issue per nama variabel', () => {
    const issues = check(
      'VAR001',
      'services:\n  a:\n    image: "x:${TAG}"\n    ports: ["${P}:80"]\n  b:\n    image: "y:${TAG}"\n',
    )
    expect(issues.map((i) => i.message)).toEqual([
      '${TAG} belum punya nilai; aturan yang bergantung padanya dilewati.',
      '${P} belum punya nilai; aturan yang bergantung padanya dilewati.',
    ])
    expect(issues[0]).toMatchObject({ services: ['a'], source: { startLine: 3, endLine: 3 } })
  })
  it('negatif: punya default', () => {
    expect(check('VAR001', 'services:\n  a:\n    image: "x:${TAG:-1}"\n')).toEqual([])
  })
})
