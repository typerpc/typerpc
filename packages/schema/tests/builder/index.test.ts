/*
 * Copyright (c) 2020. Gary Becks - <techstar.dev@hotmail.com>
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { genSourceFile, genTestFile } from '@typerpc/test-utils'
import { Project } from 'ts-morph'
import { _testing } from '../../src'

const { buildSchema, parseMessages, parseMutationServices, parseQueryServices, buildImports } = _testing
test('buildSchema() should return schema with correct number of messages and services', () => {
    const file = genSourceFile(genTestFile(), new Project())
    const schema = buildSchema(file, '')
    expect(parseMessages(file).length).toEqual(schema.messages.length)
    expect(parseQueryServices(file).length).toEqual(schema.queryServices.length)
    expect(parseMutationServices(file).length).toEqual(schema.mutationServices.length)
    expect(file.getImportDeclarations().length).toEqual(schema.imports.length)
})

test('buildImports() should return the correct import names', () => {
    const file = genSourceFile(genTestFile(), new Project())
    const imports = buildImports(file)
    const names = file
        .getImportDeclarations()
        .flatMap((imp) => imp.getNamedImports())
        .flatMap((imp) => imp.getName())
    expect(names).toEqual(imports.flatMap((imp) => imp.messageNames))
})
