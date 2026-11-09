export interface SourceRange {
  startLine: number // 1-based
  endLine: number
}

export interface ComposeModel {
  projectName?: string // field top-level `name`
  services: Service[]
  networks: Network[] // termasuk network "default" implisit
  volumes: NamedVolume[]
  hasVersionField: boolean // `version` sudah usang
  versionSource?: SourceRange
  unresolvedVars: VarRef[] // ${VAR} yang belum punya nilai
}

export interface VarRef {
  name: string // nama variabel, mis. "DB_PORT"
  raw: string // teks asli, mis. "${DB_PORT}" atau "$DB_PORT"
  service?: string // service tempat variabel dipakai, bila ada
  source: SourceRange
}

export interface Service {
  name: string
  image?: ImageRef
  build?: { context: string; dockerfile?: string }
  ports: PortMapping[]
  networks: ServiceNetworkAttachment[]
  networkMode?: string // "host", "none", "bridge", "service:x", "container:x"
  volumes: VolumeMount[]
  dependsOn: Dependency[]
  environment: EnvVar[]
  envFiles: string[]
  healthcheck?: { test: string; disabled: boolean }
  profiles: string[]
  extends?: { service: string; file?: string } // tidak di-resolve di v1
  source: SourceRange
}

export interface ImageRef {
  name: string // termasuk registry, mis. "ghcr.io/org/app"
  tag?: string
  digest?: string // "sha256:..."
  raw: string
}

export interface PortMapping {
  hostIp: string // default "0.0.0.0"
  published?: PortRange // undefined = port acak dari Docker
  target: PortRange
  protocol: 'tcp' | 'udp' | 'sctp'
  unresolved: boolean // memuat ${VAR} tanpa nilai; aturan port melewatinya
  raw: string // teks asli, untuk ditampilkan
  source: SourceRange
}

export interface PortRange {
  start: number
  end: number
} // port tunggal: start === end

export interface ServiceNetworkAttachment {
  network: string
  aliases: string[]
  ipv4Address?: string
  source: SourceRange
}

export interface Network {
  name: string // nama key di compose
  isDefault: boolean // network "default" implisit
  external: boolean
  driver?: string
  subnets: string[] // dari ipam.config[].subnet, format CIDR (bisa berisi ${VAR} mentah)
  declared: boolean // ada di top-level `networks:`?
  source?: SourceRange
}

export interface VolumeMount {
  type: 'volume' | 'bind' | 'tmpfs'
  source?: string // nama volume atau path host; undefined = volume anonim
  target: string // path di container
  readOnly: boolean
  raw: string
  sourceRange: SourceRange
}

export interface NamedVolume {
  name: string
  external: boolean
  driver?: string
  source?: SourceRange
}

export interface Dependency {
  service: string
  condition: 'service_started' | 'service_healthy' | 'service_completed_successfully'
  source: SourceRange
}

export interface EnvVar {
  key: string
  value?: string // undefined = diambil dari environment shell
  isInterpolated: boolean // value memakai ${...} atau $VAR
  source: SourceRange
}
