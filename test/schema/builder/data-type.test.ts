import {containers, is, scalars, testing} from '../../../src/schema'
import {Project, TypeAliasDeclaration} from 'ts-morph'
import {genMsgNamesFunc, genSourceFile, genSourceFiles, genTestMessageFiles} from '../util'
import {parseMsgProps} from '../../../src/schema/parser'

const {
  isType,
  useCbor,
  makeDataType,
} = testing

let project: Project
beforeEach(() => {
  project = new Project()
})

test('isType() should return true when given the proper type', () => {
  let vars = ''
  const types = [...scalars, ...containers]
  for (const type of scalars) {
    vars = vars.concat(`var ${type.replace('$.', '')}: ${type}\n`)
  }
  for (const type of containers) {
    vars = vars.concat(`var ${type.replace('$.', '')}: ${type}\n`)
  }
  genSourceFile(vars, project).getVariableDeclarations().forEach((variable, i) =>
    expect(isType(variable.getTypeNode()!, types[i])).toBeTruthy())
})

test('makeDataType() should return correct DataType for type prop', () => {
  const sources = genSourceFiles(genTestMessageFiles(genMsgNamesFunc), project)
  const types: TypeAliasDeclaration[] = sources.flatMap(source => source.getTypeAliases())
  for (const source of sources) {
    console.log(source.getText())
  }
  const propTypes = types.flatMap(type => parseMsgProps(type)).flatMap(prop => prop.getTypeNodeOrThrow())
  for (const type of propTypes) {
    const dataType = makeDataType(type)
    console.log(dataType.toString())
    expect(is.DataType(dataType)).toBeTruthy()
  }
})
