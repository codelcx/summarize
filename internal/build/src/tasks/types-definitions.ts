import path from 'node:path'
import { glob } from 'tinyglobby'
import { copy, remove } from 'fs-extra'
import { parallel, TaskFunction } from 'gulp'
import { readFile, writeFile } from 'node:fs/promises'
import { buildConfig, Module } from '../build-info'
import { buildOutput, pathRewriter, projRoot, run, withTaskName } from '../utils'

export const generateTypesDefinitions = async () =>
{
  await run(
    'npx vue-tsc -p tsconfig.web.json --declaration --emitDeclarationOnly --declarationDir dist/types',
  )
  const typesDir = path.join(buildOutput, 'types', 'packages')
  const filePaths = await glob(`**/*.d.ts`, {
    cwd: typesDir,
    absolute: true,
  })
  const rewriteTasks = filePaths.map(async (filePath) =>
  {
    const content = await readFile(filePath, 'utf8')
    await writeFile(filePath, pathRewriter('esm')(content), 'utf8')
  })
  await Promise.all(rewriteTasks)
  const sourceDir = path.join(typesDir, 'cx')
  await copy(sourceDir, typesDir)
  await remove(sourceDir)
}

export const cleanTypeBuildInfo = async () =>
{
  await remove(path.resolve(projRoot, 'tsconfig.web.tsbuildinfo'))
}

export const cleanTypesDefinitions = async () =>
{
  await remove(path.resolve(buildOutput, 'types'))
}

export const copyTypesDefinitions: TaskFunction = (done) =>
{
  const source = path.resolve(buildOutput, 'types', 'packages')
  const copyTypes = (module: Module) =>
    withTaskName(`copyTypes:${module}`, () =>
      copy(source, buildConfig[module].output.path),
    )

  return parallel(copyTypes('esm'), copyTypes('cjs'))(done)
}
