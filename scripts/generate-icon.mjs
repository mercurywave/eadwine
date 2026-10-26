import { app, nativeImage } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = path.join(rootDirectory, 'client', 'public', 'eadwine.svg')
const outputDirectory = path.join(rootDirectory, 'build')
const outputPath = path.join(outputDirectory, 'eadwine.ico')

await app.whenReady()

const source = await readFile(sourcePath)
const image = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${source.toString('base64')}`)
const png = image.resize({ width: 256, height: 256 }).toPNG()

if (png.length === 0) {
  throw new Error('Unable to render the Eadwine SVG icon.')
}

const header = Buffer.alloc(22)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(1, 4)
header.writeUInt8(0, 6)
header.writeUInt8(0, 7)
header.writeUInt8(0, 8)
header.writeUInt8(0, 9)
header.writeUInt16LE(1, 10)
header.writeUInt16LE(32, 12)
header.writeUInt32LE(png.length, 14)
header.writeUInt32LE(22, 18)

await mkdir(outputDirectory, { recursive: true })
await writeFile(outputPath, Buffer.concat([header, png]))
app.quit()