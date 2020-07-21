import { Backend, Change, Request, BackendState as BackDoc, Patch, decodeChange, encodeChange } from 'automerge'
import Queue from './Queue'
import Debug from './Debug'
import { Clock } from './Clock'
import { ActorId, DocId, rootActorId } from './Misc'

const log = Debug('DocBackend')

export type DocBackendMessage = ReadyMsg | ActorIdMsg | RemotePatchMsg | LocalPatchMsg

interface ReadyMsg {
  type: 'ReadyMsg'
  doc: DocBackend
  history?: number
  patch?: Patch
}

interface ActorIdMsg {
  type: 'ActorIdMsg'
  id: DocId
  actorId: ActorId
}

interface RemotePatchMsg {
  type: 'RemotePatchMsg'
  doc: DocBackend
  patch: Patch
  change?: Change
  history: number
}

interface LocalPatchMsg {
  type: 'LocalPatchMsg'
  doc: DocBackend
  patch: Patch
  change: Change
  history: number
}

export class DocBackend {
  id: DocId
  actorId?: ActorId // this might be easier to have as the actor object - FIXME
  clock: Clock = {}
  deps: string[] = []
  back?: BackDoc // can we make this private?
  changes: Map<string, number> = new Map()
  ready = new Queue<Function>('doc:back:readyQ')
  updateQ = new Queue<DocBackendMessage>('doc:back:updateQ')

  private localChangeQ = new Queue<Request>('doc:back:localChangeQ')
  private remoteChangesQ = new Queue<Change[]>('doc:back:remoteChangesQ')

  constructor(documentId: DocId, back?: BackDoc) {
    this.id = documentId

    if (back) {
      this.back = back
      this.actorId = rootActorId(documentId)
      this.ready.subscribe((f) => f())
      this.subscribeToRemoteChanges()
      this.subscribeToLocalChanges()
      const history = Backend.getChanges(this.back,[]).length // FIXME -- slow
      this.updateQ.push({
        type: 'ReadyMsg',
        doc: this,
        history,
      })
    }
  }

  applyRemoteChanges = (changes: Change[]): void => {
    this.remoteChangesQ.push(changes)
  }

  applyLocalChange = (request: Request): void => {
    this.localChangeQ.push(request)
  }

  initActor = (actorId: ActorId) => {
    log('initActor')
    if (this.back) {
      this.actorId = this.actorId || actorId
      this.updateQ.push({
        type: 'ActorIdMsg',
        id: this.id,
        actorId: this.actorId,
      })
    }
  }

  updateClock(changes: Change[]) {
    changes.forEach((change) => {
      const actor = change.actor
      const oldSeq = this.clock[actor] || 0
      this.clock[actor] = Math.max(oldSeq, change.seq)
    })
  }

  init = (changes: Change[], actorId?: ActorId) => {
    this.bench('init', () => {
      //console.log("CHANGES MAX",changes[changes.length - 1])
      //changes.forEach( (c,i) => console.log("CHANGES", i, c.actor, c.seq))
      const [back, patch] = Backend.applyChanges(Backend.init(), changes.map(encodeChange))
      this.deps = patch.deps
      this.actorId = this.actorId || actorId
      this.back = back
      this.updateClock(changes)
      //console.log("INIT SYNCED", this.synced, changes.length)
      this.ready.subscribe((f) => f())
      this.subscribeToLocalChanges()
      this.subscribeToRemoteChanges()
      const history = Backend.getChanges(this.back,[]).length // FIXME - this seems too slow
      this.updateQ.push({
        type: 'ReadyMsg',
        doc: this,
        patch,
        history,
      })
    })
  }

  subscribeToRemoteChanges() {
    this.remoteChangesQ.subscribe((changes) => {
      this.bench('applyRemoteChanges', () => {
        const [back, patch] = Backend.applyChanges(this.back!, changes.map(encodeChange))
        this.back = back
        this.deps = patch.deps
        this.updateClock(changes)
        const history = Backend.getChanges(this.back,[]).length // FIXME - slow
        this.updateQ.push({
          type: 'RemotePatchMsg',
          doc: this,
          patch,
          history,
        })
      })
    })
  }

  subscribeToLocalChanges() {
    this.localChangeQ.subscribe((request) => {
      this.bench(`applyLocalChange seq=${request.seq}`, () => {
        const olddeps = this.deps
        const [back, patch] = Backend.applyLocalChange(this.back!, request)

        // FIXME - this is ugly - clean it up - whats the best way to get the change we just made?
        const changes = Backend.getChanges(back,olddeps) // FIXME -- slow
        if (changes.length !== 1) {
          throw new RangeError(`applyLocalChange produced ${changes.length} changes`)
        }
        const change = decodeChange(changes[0])

        this.deps = patch.deps
        this.back = back
        this.updateClock([change])
        const history = Backend.getChanges(this.back,[]).length // FIXME -- slow
        this.updateQ.push({
          type: 'LocalPatchMsg',
          doc: this,
          change,
          patch,
          history,
        })
      })
    })
  }

  private bench(msg: string, f: () => void): void {
    const start = Date.now()
    f()
    const duration = Date.now() - start
    log(`id=${this.id} task=${msg} time=${duration}ms`)
  }
}
