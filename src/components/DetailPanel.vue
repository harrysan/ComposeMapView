<script setup lang="ts">
import { computed } from 'vue'
import { issueKeys, networkKey, serviceKey, volumeKey } from '@/core/graph/build'
import type { Dependency, EnvVar } from '@/core/model'
import { isSecretKey } from '@/core/rules'
import { useCompose } from '@/composables/useCompose'
import { t } from '@/i18n'
import { formatRange, networkColor } from './nodes/format'
import SeverityIcon from './SeverityIcon.vue'

const store = useCompose()

const conditionLabel = (c: Dependency['condition']) => t(`condition.${c}`)

const kind = computed(() => store.selected.value?.slice(0, 1) ?? null)
const name = computed(() => store.selected.value?.slice(2) ?? '')

const service = computed(() =>
  kind.value === 's' ? store.model.value?.services.find((s) => s.name === name.value) : undefined,
)
const network = computed(() =>
  kind.value === 'n' ? store.model.value?.networks.find((n) => n.name === name.value) : undefined,
)
const volumeName = computed(() => (kind.value === 'v' ? name.value : undefined))
const volume = computed(() => store.model.value?.volumes.find((v) => v.name === volumeName.value))

const relatedIssues = computed(() => {
  const key = store.selected.value
  if (!key) return []
  return store.issues.value
    .map((issue, index) => ({ issue, index }))
    .filter(({ issue }) => issueKeys(issue).includes(key))
})

const dependents = computed(() =>
  service.value
    ? (store.model.value?.services.filter((o) =>
        o.dependsOn.some((d) => d.service === name.value),
      ) ?? [])
    : [],
)

const networkMembers = computed(() =>
  network.value
    ? (store.model.value?.services
        .map((s) => ({ s, att: s.networks.find((a) => a.network === name.value) }))
        .filter((x) => x.att) ?? [])
    : [],
)

const volumeUsers = computed(() => {
  if (!volumeName.value || !store.model.value) return []
  return store.model.value.services.flatMap((s) =>
    s.volumes
      .filter((m) => m.type === 'volume' && m.source === volumeName.value)
      .map((m) => ({ s, m })),
  )
})

function colorOf(net: string) {
  const i = store.model.value?.networks.findIndex((n) => n.name === net) ?? -1
  return i < 0 ? 'var(--muted)' : networkColor(i)
}

function envValue(e: EnvVar): string | null {
  if (e.value === undefined) return null
  // Nilai rahasia disamarkan (SPEC §8.3).
  if (isSecretKey(e.key) && e.value && !e.isInterpolated) return '••••••'
  return e.value
}

const summary = computed(() => {
  const m = store.model.value
  if (!m) return null
  return {
    name: m.projectName ?? t('detail.unnamed'),
    services: m.services.length,
    networks: m.networks.length,
    volumes: m.volumes.length,
  }
})
</script>

<template>
  <aside class="detail" aria-live="polite" :aria-label="t('detail.aria')">
    <!-- Ringkasan proyek -->
    <template v-if="!store.selected.value && summary">
      <div class="d-kind">{{ t('detail.project') }}</div>
      <h2>{{ summary.name }}</h2>
      <div class="d-sub">
        {{ summary.services }} {{ t('diagram.services') }} · {{ summary.networks }}
        {{ t('diagram.networks') }} · {{ summary.volumes }} {{ t('diagram.volumes') }}
      </div>
      <section>
        <h3>{{ t('detail.summary') }}</h3>
        <div class="rows">
          <div v-for="sev in ['error', 'warning', 'info'] as const" :key="sev" class="row">
            <SeverityIcon :severity="sev" />{{ t(`severity.${sev}`) }}
            <span class="r-right">{{ store.counts.value[sev] }}</span>
          </div>
        </div>
      </section>
      <section class="overview">
        <h3>{{ t('detail.howToRead') }}</h3>
        <p>{{ t('detail.howToRead1') }}</p>
        <p>{{ t('detail.howToRead2') }}</p>
      </section>
    </template>

    <!-- Service -->
    <template v-else-if="service">
      <div class="d-kind">{{ t('detail.service') }}</div>
      <h2>{{ service.name }}</h2>
      <div class="d-sub mono">
        <template v-if="service.image">{{ service.image.raw }}</template>
        <template v-else-if="service.build"
          >build: {{ service.build.context
          }}<template v-if="service.build.dockerfile">
            · {{ service.build.dockerfile }}</template
          ></template
        >
        <template v-else>{{ t('detail.noImage') }}</template>
      </div>
      <div v-if="service.profiles.length" class="d-sub">
        {{ t('detail.profile') }}: {{ service.profiles.join(', ') }}
      </div>

      <section v-if="relatedIssues.length">
        <h3>{{ t('detail.issues') }}</h3>
        <div class="rows">
          <button
            v-for="r in relatedIssues"
            :key="r.index"
            class="row"
            @click="store.activateIssue(r.index)"
          >
            <SeverityIcon :severity="r.issue.severity" /><span>{{ r.issue.message }}</span>
          </button>
        </div>
      </section>

      <section>
        <h3>{{ t('detail.ports') }}</h3>
        <div v-if="service.ports.length" class="rows">
          <div v-for="(p, i) in service.ports" :key="i" class="row">
            <span class="mono"
              >{{ p.hostIp }}:{{
                p.published ? formatRange(p.published) : p.unresolved ? '?' : t('detail.portRandom')
              }}
              → {{ formatRange(p.target) }}</span
            >
            <span class="r-right">{{ p.protocol }}</span>
          </div>
        </div>
        <div v-else class="none">
          {{ service.networkMode === 'host' ? t('detail.hostNetwork') : t('detail.notPublished') }}
        </div>
      </section>

      <section>
        <h3>{{ t('detail.networks') }}</h3>
        <div v-if="service.networkMode" class="row">
          <span class="mono">network_mode: {{ service.networkMode }}</span>
        </div>
        <div v-else class="rows">
          <button
            v-for="a in service.networks"
            :key="a.network"
            class="row"
            @click="store.selectKey(networkKey(a.network))"
          >
            <span class="dot" :style="{ background: colorOf(a.network) }" />
            <span>{{ a.network }}</span>
            <span class="r-right mono">{{
              a.ipv4Address ??
              (a.aliases.length ? `${t('detail.alias')}: ${a.aliases.join(', ')}` : '')
            }}</span>
          </button>
        </div>
      </section>

      <section>
        <h3>{{ t('detail.mounts') }}</h3>
        <div v-if="service.volumes.length" class="rows">
          <component
            :is="m.type === 'volume' && m.source ? 'button' : 'div'"
            v-for="(m, i) in service.volumes"
            :key="i"
            class="row"
            @click="m.type === 'volume' && m.source && store.selectKey(volumeKey(m.source))"
          >
            <span class="r-muted">{{ m.type }}</span>
            <span class="mono">{{ m.source ?? t('detail.anonymous') }} → {{ m.target }}</span>
            <span v-if="m.readOnly" class="r-right">ro</span>
          </component>
        </div>
        <div v-else class="none">{{ t('detail.none') }}</div>
      </section>

      <section>
        <h3>{{ t('detail.dependsOn') }}</h3>
        <div v-if="service.dependsOn.length" class="rows">
          <button
            v-for="d in service.dependsOn"
            :key="d.service"
            class="row"
            @click="store.selectKey(serviceKey(d.service))"
          >
            <span>{{ d.service }}</span
            ><span class="r-right">{{ conditionLabel(d.condition) }}</span>
          </button>
        </div>
        <div v-else class="none">{{ t('detail.none') }}</div>
      </section>

      <section>
        <h3>{{ t('detail.dependents') }}</h3>
        <div v-if="dependents.length" class="rows">
          <button
            v-for="o in dependents"
            :key="o.name"
            class="row"
            @click="store.selectKey(serviceKey(o.name))"
          >
            {{ o.name }}
          </button>
        </div>
        <div v-else class="none">{{ t('detail.none') }}</div>
      </section>

      <section>
        <h3>{{ t('detail.environment') }}</h3>
        <div v-if="service.environment.length" class="rows">
          <div v-for="e in service.environment" :key="e.key" class="row">
            <span class="mono">{{ e.key }}</span>
            <span v-if="envValue(e) === null" class="r-right r-muted">{{
              t('detail.fromShell')
            }}</span>
            <span v-else class="r-right mono env-val" :title="envValue(e) ?? ''">{{
              envValue(e)
            }}</span>
          </div>
        </div>
        <div v-else class="none">{{ t('detail.none') }}</div>
        <div v-if="service.envFiles.length" class="d-sub env-files">
          env_file: {{ service.envFiles.join(', ') }}
        </div>
      </section>

      <section>
        <h3>{{ t('detail.healthcheck') }}</h3>
        <div v-if="service.healthcheck && !service.healthcheck.disabled" class="row">
          <span class="mono">{{ service.healthcheck.test || t('detail.healthFromImage') }}</span>
        </div>
        <div v-else class="none">
          {{ service.healthcheck?.disabled ? t('detail.disabled') : t('detail.none') }}
        </div>
      </section>

      <button class="goto" @click="store.gotoLine(service.source.startLine)">
        {{ t('detail.goto', { line: service.source.startLine }) }}
      </button>
    </template>

    <!-- Network -->
    <template v-else-if="network">
      <div class="d-kind">{{ t('detail.network') }}</div>
      <h2>
        <span class="dot big" :style="{ background: colorOf(network.name) }" /> {{ network.name }}
      </h2>
      <div class="d-sub">
        <template v-if="network.isDefault && !network.declared">{{
          t('detail.autoNetwork')
        }}</template>
        <template v-else-if="!network.declared">{{ t('detail.undeclared') }}</template>
        <template v-else-if="network.external">{{ t('detail.external') }}</template>
        <template v-else>{{ t('detail.driver', { driver: network.driver ?? 'bridge' }) }}</template>
      </div>

      <section v-if="relatedIssues.length">
        <h3>{{ t('detail.issues') }}</h3>
        <div class="rows">
          <button
            v-for="r in relatedIssues"
            :key="r.index"
            class="row"
            @click="store.activateIssue(r.index)"
          >
            <SeverityIcon :severity="r.issue.severity" /><span>{{ r.issue.message }}</span>
          </button>
        </div>
      </section>

      <section>
        <h3>{{ t('detail.subnet') }}</h3>
        <div v-if="network.subnets.length" class="rows">
          <div v-for="c in network.subnets" :key="c" class="row">
            <span class="mono">{{ c }}</span>
          </div>
        </div>
        <div v-else class="none">{{ t('detail.autoSubnet') }}</div>
      </section>

      <section>
        <h3>{{ t('detail.members') }}</h3>
        <div v-if="networkMembers.length" class="rows">
          <button
            v-for="x in networkMembers"
            :key="x.s.name"
            class="row"
            @click="store.selectKey(serviceKey(x.s.name))"
          >
            <span>{{ x.s.name }}</span
            ><span class="r-right mono">{{ x.att?.ipv4Address ?? '' }}</span>
          </button>
        </div>
        <div v-else class="none">{{ t('detail.none') }}</div>
      </section>

      <button v-if="network.source" class="goto" @click="store.gotoLine(network.source.startLine)">
        {{ t('detail.goto', { line: network.source.startLine }) }}
      </button>
    </template>

    <!-- Volume -->
    <template v-else-if="volumeName">
      <div class="d-kind">{{ t('detail.volume') }}</div>
      <h2>{{ volumeName }}</h2>
      <div class="d-sub">
        <template v-if="!volume">{{ t('detail.undeclared') }}</template>
        <template v-else-if="volume.external">{{ t('detail.externalShort') }}</template>
        <template v-else>{{ t('detail.driver', { driver: volume.driver ?? 'local' }) }}</template>
      </div>

      <section v-if="relatedIssues.length">
        <h3>{{ t('detail.issues') }}</h3>
        <div class="rows">
          <button
            v-for="r in relatedIssues"
            :key="r.index"
            class="row"
            @click="store.activateIssue(r.index)"
          >
            <SeverityIcon :severity="r.issue.severity" /><span>{{ r.issue.message }}</span>
          </button>
        </div>
      </section>

      <section>
        <h3>{{ t('detail.usedBy') }}</h3>
        <div v-if="volumeUsers.length" class="rows">
          <button
            v-for="(u, i) in volumeUsers"
            :key="i"
            class="row"
            @click="store.selectKey(serviceKey(u.s.name))"
          >
            <span>{{ u.s.name }}</span>
            <span class="r-right mono">{{ u.m.target }}{{ u.m.readOnly ? ' (ro)' : '' }}</span>
          </button>
        </div>
        <div v-else class="none">{{ t('detail.none') }}</div>
      </section>

      <button v-if="volume?.source" class="goto" @click="store.gotoLine(volume.source.startLine)">
        {{ t('detail.goto', { line: volume.source.startLine }) }}
      </button>
    </template>
  </aside>
</template>

<style scoped>
.detail {
  width: 300px;
  flex: none;
  border-left: 1px solid var(--line);
  overflow: auto;
  padding: 16px;
  font-size: 13px;
  background: var(--surface);
}
.d-kind {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  font-weight: 600;
}
h2 {
  margin: 2px 0;
  font-size: 18px;
  font-weight: 600;
  word-break: break-word;
  display: flex;
  align-items: center;
  gap: 8px;
}
.d-sub {
  color: var(--muted);
  font-size: 12px;
  word-break: break-all;
}
section {
  margin-top: 16px;
}
h3 {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 6px;
  background: var(--surface-2);
  font-size: 12.5px;
  min-width: 0;
  text-align: left;
  border: 1px solid transparent;
  width: 100%;
}
.row .mono {
  font-size: 12px;
  word-break: break-all;
}
.r-muted {
  color: var(--muted);
}
.r-right {
  margin-left: auto;
  flex: none;
  color: var(--muted);
  font-size: 11.5px;
}
.env-val {
  max-width: 55%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.env-files {
  margin-top: 6px;
}
button.row {
  cursor: pointer;
}
button.row:hover {
  border-color: var(--accent);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
  display: inline-block;
}
.dot.big {
  width: 10px;
  height: 10px;
}
.none {
  color: var(--muted);
  font-size: 12.5px;
}
.goto {
  margin-top: 18px;
  background: none;
  border: 0;
  padding: 0;
  color: var(--accent);
  cursor: pointer;
  font-size: 12.5px;
}
.goto:hover {
  text-decoration: underline;
}
.overview p {
  margin: 6px 0;
  color: var(--muted);
}
</style>
