import test from 'tape'
import { testRepoPair, generateServerPath } from './misc'
import * as Stream from '../src/StreamLogic'
import { HyperfileUrl } from '../src'

test('FileServer', (t) => {
  const [repoA, repoB] = testRepoPair()

  repoA.startFileServer(generateServerPath())
  repoB.startFileServer(generateServerPath())

  t.test('write and immediately read hyperfile', async (t) => {
    t.plan(2)

    const bufferA = Buffer.alloc(1024 * 1024, 1)
    const headerA = await repoA.files.write(Stream.fromBuffer(bufferA), 'application/octet-stream')

    const [headerB, stream] = await repoA.files.read(headerA.url)
    const bufferB = await Stream.toBuffer(stream)

    t.deepEqual(headerB, headerA, 'repoA gets written header')
    t.deepEqual(bufferB, bufferA, 'repoA gets written data')
  })

  t.test('read header of new hyperfile', async (t) => {
    t.plan(2)

    const bufferA = Buffer.alloc(1024 * 1024, 1)
    const headerA = await repoA.files.write(Stream.fromBuffer(bufferA), 'application/octet-stream')

    const [headerB, stream] = await repoB.files.read(headerA.url)
    const bufferB = await Stream.toBuffer(stream)

    t.deepEqual(headerB, headerA, 'repoB gets header from repoA')
    t.deepEqual(bufferB, bufferA, 'repoB gets data from repoA')
  })

  t.test('invalid URL responds with 404', async (t) => {
    t.plan(1)

    const fakeUrl = '21dee03b7480e7e20bd035e912eb51c5c4209f6a4ce885d442bf2a304bc093c3' as HyperfileUrl

    try {
      await repoA.files.read(fakeUrl)
    } catch (e) {
      t.equal(e.message, 'Server error, code=404 message=Not Found', 'request errors')
    }
  })

  t.test('short timeout causes socket hang-up', async (t) => {
    t.plan(1)

    const fakeUrl = 'hyperfile:/21dee03b7480e7e20bd035e912eb51c5c4209f6a4ce885d442bf2a304bc093c3' as HyperfileUrl
    ;(repoA.back as any).fileServer.http.setTimeout(100)

    try {
      await repoA.files.read(fakeUrl)
    } catch (e) {
      t.equal(e.message, 'socket hang up', 'request times out')
    } finally {
      ;(repoA.back as any).fileServer.http.setTimeout(0)
    }
  })

  test.onFinish(() => {
    repoA.close()
    repoB.close()
  })
})
