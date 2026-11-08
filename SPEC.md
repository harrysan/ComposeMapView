# SPEC — ComposeMapView

> Nama kerja: **ComposeMapView**. Visualizer dan linter untuk `docker-compose.yml` yang berjalan sepenuhnya di browser.

|         |                 |
| ------- | --------------- |
| Status  | Draft v0.1      |
| Tanggal | 3 November 2026 |
| Penulis | HSO             |

---

## 1. Ringkasan

ComposeMapView menerima file `docker-compose.yml`, lalu:

1. **Menggambar diagram interaktif**: service, network, port, volume, dan dependensi antar service.
2. **Menjalankan linter**: mendeteksi masalah seperti port bentrok, subnet tumpang tindih, dependensi melingkar, dan konfigurasi yang rawan.
3. **Membuat link share**: diagram bisa dibagikan lewat URL tanpa server dan tanpa database.

Semua proses berjalan di browser. File user tidak pernah dikirim ke server mana pun, dan ini perlu ditonjolkan di halaman depan.

## 2. Tujuan dan Non-Tujuan

### Tujuan

- Developer bisa memahami struktur compose file dalam beberapa detik, termasuk compose milik orang lain.
- Menemukan kesalahan konfigurasi **sebelum** `docker compose up` gagal atau berperilaku aneh.
- Menjadi proyek portofolio dengan kode yang rapi, teruji, dan demo yang bisa langsung dicoba.

### Non-Tujuan (setidaknya untuk v1)

- Tidak menjalankan container atau terhubung ke Docker daemon.
- Bukan editor visual (drag node untuk mengubah YAML). Diagram hanya membaca.
- Tidak mendukung Kubernetes, Swarm stack (`deploy:` diabaikan), atau format lain.
- Tidak memvalidasi seluruh Compose Specification secara lengkap. Fokusnya pada field yang memengaruhi topologi dan masalah umum.

## 3. Pengguna dan Skenario

| Pengguna            | Skenario                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| Developer backend   | Baru clone project, ingin cepat paham service apa saja dan bagaimana saling terhubung.                    |
| DevOps / sysadmin   | Menambah stack baru ke server yang sudah punya banyak network, dan ingin memastikan subnet tidak bentrok. |
| Reviewer PR         | Membuka link share untuk melihat diagram dan masalah tanpa menjalankan apa pun.                           |
| Penulis dokumentasi | Export diagram ke PNG/SVG untuk README atau wiki.                                                         |

## 4. Fitur

Prioritas: **P0** = wajib ada di MVP, **P1** = setelah MVP, **P2** = nice to have.

| ID  | Fitur                                                              | Prioritas |
| --- | ------------------------------------------------------------------ | --------- |
| F1  | Input YAML: tempel teks, drag-drop file, atau pilih contoh         | P0        |
| F2  | Editor YAML dengan syntax highlighting dan penanda error per baris | P0        |
| F3  | Diagram service, network, volume, dan `depends_on`                 | P0        |
| F4  | Panel detail saat node diklik                                      | P0        |
| F5  | Linter dengan daftar masalah                                       | P0        |
| F6  | Klik masalah → sorot node dan baris YAML terkait                   | P0        |
| F7  | Link share (YAML dikompres ke URL hash)                            | P0        |
| F8  | Contoh compose file siap pakai (minimal 3)                         | P0        |
| F9  | Export diagram ke PNG dan SVG                                      | P1        |
| F10 | Cek bentrok subnet dengan jaringan host                            | P1        |
| F11 | Input file `.env` untuk me-resolve variabel `${VAR}`               | P1        |
| F12 | Filter tampilan: sembunyikan volume/port, sorot satu network       | P1        |
| F13 | Diff dua versi compose file                                        | P2        |
| F14 | CLI Go yang menjalankan aturan linter yang sama (untuk CI)         | P2        |
| F15 | Dukungan beberapa file (`-f a.yml -f b.yml`, override)             | P2        |

## 5. Arsitektur

Alur data satu arah, semua di browser:

```
 YAML text
    │
    ▼
 ┌──────────┐   error sintaks (baris, kolom)
 │  Parser  │──────────────────────────────► IssueList
 └──────────┘
    │ dokumen YAML + posisi sumber
    ▼
 ┌─────────────┐
 │ Normalizer  │  semua bentuk penulisan → satu model internal
 └─────────────┘
    │ ComposeModel
    ├──────────────────────┐
    ▼                      ▼
 ┌──────────┐        ┌─────────────┐
 │  Rules   │        │ GraphBuilder│
 │ (linter) │        └─────────────┘
 └──────────┘              │ nodes + edges
    │ Issue[]              ▼
    ▼                ┌──────────┐
 IssueList ◄────────►│ Diagram  │  (sorot node ↔ masalah)
                     └──────────┘
```

Prinsip penting:

- **Parser, Normalizer, Rules, dan GraphBuilder adalah fungsi murni TypeScript** tanpa ketergantungan pada Vue. Dengan begitu mudah diuji, dan nantinya logikanya bisa di-port ke CLI Go.
- **Setiap aturan linter berada di file sendiri** dan hanya menerima `ComposeModel`. Menambah aturan baru tidak perlu menyentuh kode lain.
- Parsing ulang dijalankan dengan debounce sekitar 300 ms setelah user berhenti mengetik.

## 6. Model Internal

Bagian paling penting dari proyek. Compose file punya banyak cara penulisan untuk hal yang sama. Normalizer menyeragamkan semuanya, sehingga Rules dan GraphBuilder cukup menangani satu bentuk.

```ts
/** Posisi di file sumber, untuk menyorot baris di editor. */
interface SourceRange {
  startLine: number // 1-based
  endLine: number
}

interface ComposeModel {
  projectName?: string // field top-level `name`
  services: Service[]
  networks: Network[] // termasuk network "default" implisit
  volumes: NamedVolume[]
  hasVersionField: boolean // `version` sudah usang
  unresolvedVars: VarRef[] // ${VAR} yang belum punya nilai
}

interface Service {
  name: string
  image?: { name: string; tag?: string; digest?: string; raw: string }
  build?: { context: string; dockerfile?: string }
  ports: PortMapping[]
  networks: ServiceNetworkAttachment[]
  networkMode?: string // "host", "none", "service:x", "container:x"
  volumes: VolumeMount[]
  dependsOn: Dependency[]
  environment: EnvVar[]
  envFiles: string[]
  healthcheck?: { test: string; disabled: boolean }
  profiles: string[]
  source: SourceRange
}

interface PortMapping {
  hostIp: string // default "0.0.0.0"
  published?: PortRange // undefined = port acak dari Docker
  target: PortRange
  protocol: 'tcp' | 'udp'
  raw: string // teks asli, untuk ditampilkan
  source: SourceRange
}

interface PortRange {
  start: number
  end: number
} // port tunggal: start === end

interface ServiceNetworkAttachment {
  network: string
  aliases: string[]
  ipv4Address?: string
  source: SourceRange
}

interface Network {
  name: string // nama key di compose
  isDefault: boolean // network "default" implisit
  external: boolean
  driver?: string
  subnets: string[] // dari ipam.config[].subnet, format CIDR
  declared: boolean // ada di top-level `networks:`?
  source?: SourceRange
}

interface VolumeMount {
  type: 'volume' | 'bind' | 'tmpfs'
  source?: string // nama volume atau path host
  target: string // path di container
  readOnly: boolean
  raw: string
  sourceRange: SourceRange
}

interface NamedVolume {
  name: string
  external: boolean
  driver?: string
}

interface Dependency {
  service: string
  condition: 'service_started' | 'service_healthy' | 'service_completed_successfully'
  source: SourceRange
}

interface EnvVar {
  key: string
  value?: string // undefined = diambil dari environment shell
  isInterpolated: boolean // value memakai ${...}
  source: SourceRange
}
```

### 6.1 Aturan Normalisasi

| Field                 | Bentuk yang harus didukung                                                                                                                              | Hasil                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `ports`               | `"80"`, `"8080:80"`, `"127.0.0.1:8080:80"`, `"8080-8081:80-81"`, `"53:53/udp"`, angka `80`, long syntax `{target, published, host_ip, protocol}`        | `PortMapping`                                                             |
| `networks` (service)  | list `[a, b]` atau map `{a: {aliases, ipv4_address}}`, termasuk `a: null`                                                                               | `ServiceNetworkAttachment[]`                                              |
| `networks` (implisit) | service tanpa `networks` dan tanpa `network_mode`                                                                                                       | otomatis tergabung ke network `default`                                   |
| `volumes` (service)   | `"data:/var/lib/mysql"`, `"./src:/app:ro"`, `"/abs/path:/x"`, `"/only/container/path"` (volume anonim), long syntax `{type, source, target, read_only}` | `VolumeMount`. Source diawali `.`, `/`, atau `~` berarti bind             |
| `depends_on`          | list `[db]` atau map `{db: {condition: service_healthy}}`                                                                                               | `Dependency[]`, condition default `service_started`                       |
| `environment`         | list `["A=1", "B"]` atau map `{A: 1, B: null}`                                                                                                          | `EnvVar[]`                                                                |
| `image`               | `mysql`, `mysql:8.4`, `ghcr.io/org/app:1.2`, `registry:5000/app`, `app@sha256:...`                                                                      | Hati-hati: titik dua pada `registry:5000` adalah port registry, bukan tag |
| `healthcheck`         | `test` berupa string atau list, `disable: true`                                                                                                         | `healthcheck`                                                             |

Variabel `${VAR}`, `${VAR:-default}`, `${VAR-default}`, dan `$VAR`:

- Tanpa file `.env`: pakai nilai default bila ada. Bila tidak ada, catat di `unresolvedVars` dan tampilkan nilai mentahnya.
- Port atau subnet yang tidak bisa di-resolve **dilewati** oleh aturan terkait. Jangan sampai muncul peringatan palsu.

## 7. Aturan Linter

Setiap aturan menghasilkan nol atau lebih `Issue`:

```ts
interface Issue {
  ruleId: string // contoh: "PORT001"
  severity: 'error' | 'warning' | 'info'
  message: string // bahasa manusia, sebut nama service/port
  hint?: string // saran perbaikan
  services: string[] // untuk menyorot node di diagram
  source?: SourceRange // untuk menyorot baris di editor
}

interface Rule {
  id: string
  severity: Issue['severity']
  title: string
  check(model: ComposeModel): Issue[]
}
```

### 7.1 Daftar Aturan v1

| ID      | Severity | Kondisi                                                                                                                     | Contoh pesan                                                                    |
| ------- | -------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| CFG001  | error    | Service tidak punya `image` maupun `build`                                                                                  | `Service "worker" tidak punya image atau build.`                                |
| CFG002  | info     | Field `version` masih dipakai                                                                                               | `Field "version" sudah usang dan diabaikan Docker Compose v2.`                  |
| CFG003  | warning  | `network_mode: host` digabung dengan `ports`                                                                                | `Port di "nginx" diabaikan karena network_mode: host.`                          |
| PORT001 | error    | Dua mapping memakai port host yang sama (lihat 7.2)                                                                         | `Port host 8080/tcp dipakai oleh "web" dan "admin".`                            |
| NET001  | error    | Dua network punya subnet yang tumpang tindih                                                                                | `Subnet 172.20.0.0/16 (backend) tumpang tindih dengan 172.20.5.0/24 (db).`      |
| NET002  | error    | Service memakai network yang tidak dideklarasikan                                                                           | `Network "cache" dipakai "app" tapi tidak dideklarasikan.`                      |
| NET003  | error    | `ipv4_address` di luar subnet network-nya                                                                                   | `IP 10.0.1.5 milik "db" berada di luar subnet 172.20.0.0/24.`                   |
| NET004  | error    | Dua service memakai `ipv4_address` yang sama di network yang sama                                                           |                                                                                 |
| NET005  | warning  | `ipv4_address` dipakai, tapi network tidak punya subnet eksplisit                                                           | `Static IP butuh ipam.config.subnet di network "backend".`                      |
| DEP001  | error    | `depends_on` menunjuk service yang tidak ada                                                                                |                                                                                 |
| DEP002  | error    | Dependensi melingkar                                                                                                        | `Dependensi melingkar: app → worker → app.`                                     |
| DEP003  | warning  | `condition: service_healthy`, tapi service tujuan tidak punya healthcheck                                                   | `"app" menunggu "db" sehat, tapi "db" tidak punya healthcheck.`                 |
| VOL001  | error    | Named volume dipakai tapi tidak dideklarasikan di top-level `volumes`                                                       |                                                                                 |
| VOL002  | info     | Named volume dideklarasikan tapi tidak dipakai                                                                              |                                                                                 |
| IMG001  | warning  | Image tanpa tag atau memakai `:latest`                                                                                      | `Image "redis" tanpa tag; versi bisa berubah sewaktu-waktu.`                    |
| SEC001  | warning  | Env dengan key mirip rahasia (`PASSWORD`, `SECRET`, `TOKEN`, `API_KEY`, `PRIVATE_KEY`) berisi nilai literal, bukan `${VAR}` | `MYSQL_ROOT_PASSWORD di "db" ditulis langsung di file.`                         |
| SEC002  | warning  | Port database umum (3306, 5432, 6379, 27017, 9200) dipublish ke `0.0.0.0`                                                   | `Port 3306 "db" terbuka ke semua interface. Pertimbangkan 127.0.0.1:3306:3306.` |
| VAR001  | info     | Variabel tidak bisa di-resolve                                                                                              | `${DB_PORT} belum punya nilai; aturan port dilewati.`                           |

### 7.2 Detail PORT001

Dua mapping dianggap bentrok bila **semua** kondisi berikut terpenuhi:

1. Protokol sama (tcp/tcp atau udp/udp).
2. Rentang port host saling beririsan (`a.start <= b.end && b.start <= a.end`).
3. Host IP beririsan: sama persis, atau salah satunya `0.0.0.0` / `::`.

Mapping tanpa `published` (port acak) tidak pernah dianggap bentrok. Service dengan `network_mode: host` tidak diperiksa (sudah ditangani CFG003).

### 7.3 Detail NET001 dan NET003

- Hanya IPv4 di v1. IPv6 dilewati tanpa error.
- Konversi CIDR ke rentang integer 32-bit, lalu cek irisan rentang. Tulis sendiri (sekitar 30 baris) daripada menambah dependency, dan uji dengan banyak kasus.
- Network `external: true` dilewati karena subnet-nya tidak diketahui dari file.

### 7.4 Aturan P1: HOST001 (cek bentrok dengan jaringan host)

User menempel salah satu input berikut:

- Output `docker network inspect $(docker network ls -q)` (JSON), atau
- Output `ip -4 route`, atau
- Daftar CIDR manual, satu per baris.

App mengekstrak semua CIDR, lalu memeriksa irisannya dengan subnet di compose. Bila network compose **tidak** punya subnet eksplisit, tampilkan `info`: Docker akan memilih subnet otomatis, dan sebaiknya ditentukan sendiri bila server punya banyak network.

## 8. Diagram

### 8.1 Pemetaan ke Node dan Edge

| Elemen               | Representasi                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------- |
| Service              | Node utama: nama, image:tag, ikon status (merah bila punya issue error, kuning bila warning) |
| Port                 | Badge di node service: `8080→80`                                                             |
| Network              | Node "hub" berbentuk pil. Edge berwarna dari service ke network. Warna konsisten per network |
| `depends_on`         | Panah putus-putus dari service ke service. Label `healthy` bila condition `service_healthy`  |
| Named volume         | Node silinder. Edge ke service, label path target                                            |
| Bind mount           | Ditampilkan di panel detail saja (tidak jadi node) supaya diagram tidak ramai                |
| `network_mode: host` | Badge "host network" di node, tanpa edge network                                             |

**Keputusan desain:** network digambar sebagai node hub, **bukan** kotak pengelompok. Satu service bisa tergabung ke beberapa network, sedangkan satu node tidak bisa berada di dalam dua kotak sekaligus. Mode "kelompokkan per network" bisa ditambahkan nanti sebagai opsi bila setiap service hanya punya satu network.

### 8.2 Layout

- Gunakan `elkjs` dengan algoritma `layered`, arah kiri ke kanan, mengikuti arah `depends_on`.
- Layout dihitung ulang hanya bila struktur berubah (service, network, atau edge), bukan setiap ketikan.
- User bisa menggeser node secara manual. Posisi manual tidak disimpan di v1.

### 8.3 Interaksi

- Klik node service → panel detail di kanan (image, port, network + alias + IP, volume, env dengan nilai rahasia disamarkan, healthcheck, issue terkait).
- Hover network → sorot semua service di network itu.
- Klik issue → node terkait disorot dan editor melompat ke baris terkait.
- Zoom, pan, dan tombol "fit view".

## 9. UI

```
┌───────────────────────────────────────────────────────────────┐
│ ComposeMapView   [Contoh ▾] [Upload] [Share] [Export ▾]    🔒 Lokal │
├──────────────────────┬────────────────────────────────────────┤
│                      │                                        │
│   Editor YAML        │              Diagram                   │
│   (Monaco)           │                                        │
│                      │                          ┌───────────┐ │
│                      │                          │  Detail   │ │
│                      │                          │  service  │ │
├──────────────────────┴──────────────────────────┴───────────┴─┤
│ Masalah (3 error, 2 warning)                         [Filter ▾] │
│  ● PORT001  Port host 8080/tcp dipakai "web" dan "admin"  L12 │
│  ▲ DEP003   "app" menunggu "db" sehat, tapi db tanpa health…  │
└───────────────────────────────────────────────────────────────┘
```

- Panel editor bisa diciutkan supaya diagram tampil penuh.
- Di layar sempit (< 900px), editor, diagram, dan daftar masalah menjadi tab.
- Dukung dark mode mengikuti setelan sistem.
- Badge "🔒 Lokal" menjelaskan bahwa file tidak dikirim ke mana pun.

## 10. Link Share

- YAML dikompres dengan `lz-string` (`compressToEncodedURIComponent`) dan diletakkan di **hash URL**: `https://.../#c=<data>`. Isi hash tidak pernah dikirim ke server.
- Saat halaman dibuka dengan hash, editor langsung terisi dan diagram langsung tampil.
- Bila hasil kompresi lebih dari ~8.000 karakter, tampilkan peringatan bahwa beberapa aplikasi chat bisa memotong link sepanjang itu.
- Sebelum menyalin link, tampilkan peringatan bila SEC001 aktif: link berisi password yang tertulis di file.

## 11. Stack Teknologi

| Kebutuhan     | Pilihan                                                | Alasan                                                                                                                   |
| ------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Framework     | Vue 3 + Vite + TypeScript                              | Sesuai keahlian, build cepat                                                                                             |
| Parsing YAML  | `yaml` (eemeli/yaml)                                   | Menyediakan posisi baris tiap node lewat `LineCounter`. `js-yaml` tidak menyediakan ini, padahal fitur F6 membutuhkannya |
| Diagram       | Vue Flow (`@vue-flow/core`)                            | Node kustom berbasis komponen Vue, zoom/pan bawaan                                                                       |
| Layout        | `elkjs`                                                | Layout graf berlapis yang rapi, berjalan di browser (bisa di Web Worker)                                                 |
| Editor        | Monaco (`@guolao/vue-monaco-editor`) atau CodeMirror 6 | Monaco lebih lengkap, CodeMirror jauh lebih ringan. Lihat bagian 15                                                      |
| Kompresi URL  | `lz-string`                                            | Kecil dan stabil                                                                                                         |
| Export gambar | `html-to-image`                                        | Sudah umum dipakai bersama Vue Flow                                                                                      |
| Styling       | Tailwind CSS                                           | Cepat untuk layout                                                                                                       |
| Test          | Vitest (+ Playwright untuk e2e di M5)                  | Satu ekosistem dengan Vite                                                                                               |
| Deploy        | Vercel atau GitHub Pages                               | Gratis, situs statis                                                                                                     |

## 12. Struktur Proyek

```
ComposeMapView/
├── src/
│   ├── core/                     # TypeScript murni, tanpa Vue
│   │   ├── parser.ts             # teks → dokumen YAML + error sintaks
│   │   ├── normalize/
│   │   │   ├── index.ts
│   │   │   ├── ports.ts
│   │   │   ├── networks.ts
│   │   │   ├── volumes.ts
│   │   │   ├── image.ts
│   │   │   └── interpolate.ts
│   │   ├── model.ts              # interface ComposeModel, dll.
│   │   ├── rules/
│   │   │   ├── index.ts          # daftar semua aturan
│   │   │   ├── port001-host-port-conflict.ts
│   │   │   ├── net001-subnet-overlap.ts
│   │   │   └── ...
│   │   ├── graph/
│   │   │   ├── build.ts          # model → nodes + edges
│   │   │   └── layout.ts         # elkjs
│   │   └── util/
│   │       └── cidr.ts
│   ├── components/
│   │   ├── YamlEditor.vue
│   │   ├── DiagramView.vue
│   │   ├── nodes/                # ServiceNode.vue, NetworkNode.vue, VolumeNode.vue
│   │   ├── DetailPanel.vue
│   │   └── IssueList.vue
│   ├── composables/
│   │   ├── useCompose.ts         # state utama: yaml → model → issues → graph
│   │   └── useShareLink.ts
│   ├── examples/                 # contoh compose file
│   ├── App.vue
│   └── main.ts
├── tests/
│   ├── fixtures/                 # *.yml + *.expected.json
│   └── core/                     # unit test per modul
├── SPEC.md
└── README.md
```

## 13. Strategi Pengujian

- **Unit test normalizer:** setiap bentuk penulisan di tabel 6.1 punya minimal satu test.
- **Unit test aturan:** setiap aturan punya minimal satu kasus positif (issue muncul) dan satu kasus negatif (tidak ada issue palsu).
- **Fixture test:** folder `tests/fixtures/` berisi compose file nyata, masing-masing dengan file `expected.json` berisi daftar `ruleId` yang diharapkan. Satu test membaca semua fixture secara otomatis. Sumber fixture yang bagus: repo `docker/awesome-compose`.
- **Unit test CIDR:** termasuk kasus tepi seperti `/32`, `/0`, subnet yang identik, dan subnet yang bersebelahan tapi tidak beririsan.
- **E2E (M5):** satu skenario Playwright: buka contoh → diagram tampil → klik issue → node tersorot → salin link share → buka link → hasilnya sama.
- **Target coverage** untuk `src/core/`: minimal 90%.

## 14. Kebutuhan Non-Fungsional

- **Performa:** compose dengan 50 service selesai di-parse, di-lint, dan di-layout dalam waktu kurang dari 1 detik di laptop biasa.
- **Privasi:** tidak ada request jaringan yang membawa isi file. Analytics (bila ada) hanya mencatat page view.
- **Ketahanan:** YAML yang tidak valid tidak boleh membuat app crash. Tampilkan error sintaks dan pertahankan diagram terakhir yang valid.
- **Aksesibilitas:** severity tidak hanya dibedakan dengan warna (pakai ikon ● ▲ ℹ), daftar masalah bisa dinavigasi dengan keyboard.
- **Browser:** dua versi terakhir Chrome, Firefox, Safari, dan Edge.

## 15. Pertanyaan Terbuka

1. **Monaco atau CodeMirror 6?** Monaco sekitar 2–3 MB, CodeMirror sekitar 300 KB. Untuk aplikasi yang dibuka dari link share, CodeMirror mungkin lebih tepat karena halaman lebih cepat dimuat.
2. **Profiles:** tampilkan semua service, atau sediakan pilihan profile aktif? Usulan: tampilkan semua di v1, beri badge nama profile.
3. **`extends` dan `include`:** keduanya merujuk file lain yang tidak tersedia di browser. Usulan: tampilkan info "tidak di-resolve" di v1.
4. **Nama proyek final:** ComposeMapView masih nama kerja. Cek dulu ketersediaan nama domain dan repo.

---

# Roadmap

Estimasi mengasumsikan pengerjaan paruh waktu, sekitar 8–10 jam per minggu. Setiap milestone diakhiri dengan sesuatu yang bisa didemokan.

## M0 — Persiapan (minggu 1)

- [ ] Inisialisasi Vite + Vue 3 + TypeScript + Tailwind + Vitest
- [ ] ESLint + Prettier, GitHub Actions untuk menjalankan test di setiap push
- [ ] Deploy halaman kosong ke Vercel atau GitHub Pages
- [ ] Kumpulkan 10–15 compose file nyata sebagai fixture

**Selesai bila:** `npm test` berjalan di CI dan URL publik sudah aktif.

## M1 — Parser dan Normalizer (minggu 2–3)

- [ ] `parser.ts` dengan pelacakan posisi baris
- [ ] Normalizer untuk ports, networks (termasuk `default` implisit), volumes, depends_on, environment, image, healthcheck
- [ ] Interpolasi variabel dengan dukungan nilai default
- [ ] Unit test untuk semua bentuk di tabel 6.1

**Selesai bila:** semua fixture berhasil dinormalisasi tanpa error, dan hasilnya bisa dicek lewat `console.log` atau snapshot test.

## M2 — Diagram Dasar (minggu 4–5)

- [ ] Editor YAML di kiri, diagram di kanan
- [ ] Node service, node network, node volume, edge `depends_on`
- [ ] Layout otomatis dengan elkjs
- [ ] Panel detail saat node diklik
- [ ] 3 contoh compose file di menu "Contoh"

**Selesai bila:** mengetik di editor memperbarui diagram, dan contoh Laravel + MySQL + Redis + Nginx tampil rapi.

## M3 — Linter (minggu 6–7)

- [ ] Interface `Rule` dan registry aturan
- [ ] Utilitas CIDR dan test-nya
- [ ] Semua aturan di tabel 7.1
- [ ] Panel daftar masalah dengan filter severity
- [ ] Klik issue → sorot node dan baris editor
- [ ] Fixture test otomatis dengan `expected.json`

**Selesai bila:** semua aturan punya test positif dan negatif, dan fixture dari awesome-compose tidak memunculkan error palsu.

## M4 — Share dan Polish (minggu 8)

- [ ] Link share lewat hash URL + peringatan bila ada rahasia di file
- [ ] Tampilan mobile berbasis tab
- [ ] Dark mode
- [ ] Empty state dan pesan error yang ramah
- [ ] Uji performa dengan file berisi 50 service

**Selesai bila:** link share bisa dibuka di perangkat lain dan hasilnya identik.

## 🚀 Rilis v1.0 (akhir minggu 8)

- [ ] README dengan GIF demo, daftar aturan, dan penjelasan arsitektur
- [ ] Halaman depan dengan tombol "Coba contoh" yang langsung menampilkan diagram
- [ ] Posting ke LinkedIn, Reddit (r/docker, r/selfhosted), dan komunitas developer Indonesia

## M5 — Fitur Pembeda (minggu 9–11)

- [ ] HOST001: cek bentrok subnet dengan jaringan host (F10)
- [ ] Input file `.env` (F11)
- [ ] Export PNG/SVG (F9)
- [ ] Filter tampilan dan sorot per network (F12)
- [ ] Tes E2E Playwright

## M6 — Lanjutan (opsional)

- [ ] Diff dua versi compose (F13)
- [ ] CLI Go dengan aturan yang sama, output format GitHub Actions annotations (F14)
- [ ] Dukungan beberapa file / override (F15)

## Ringkasan Jadwal

| Milestone | Minggu | Hasil yang bisa didemokan  |
| --------- | ------ | -------------------------- |
| M0        | 1      | Halaman kosong online + CI |
| M1        | 2–3    | Model internal teruji      |
| M2        | 4–5    | Diagram interaktif         |
| M3        | 6–7    | Linter lengkap             |
| M4        | 8      | **v1.0 rilis**             |
| M5        | 9–11   | Fitur pembeda              |
| M6        | 12+    | Opsional                   |
