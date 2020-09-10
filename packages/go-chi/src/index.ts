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

import { MutationService, Param, QueryMethod, QueryService, Schema } from '@typerpc/schema'
import { capitalize, lowerCase } from '@typerpc/plugin-utils'
import { Code } from '@typerpc/plugin'
import { buildFileName, buildInterfaces, buildTypes } from '@typerpc/go-plugin-utils'

const parseUrlParams = (params: ReadonlyArray<Param>): string => {
    let parsed = `q := req.URL.Query()
  `
    for (const param of params) {
        parsed = parsed.concat(`${param.name} := q.Get("${param.name}")
    `)
    }
    return parsed
}
const buildGetHandler = (method: QueryMethod) => {
    return `
   r.Get("/${method.name}", func(res http.ResponseWriter, req *http.Request) {
    ${parseUrlParams(method.params)}
	})`
}
const buildRoutes = (svc: QueryService | MutationService): string => {
    return `
func ${capitalize(svc.name)}Routes(${lowerCase(svc.name)} ${capitalize(
        svc.name,
    )}, middlewares ...func(handler http.Handler) http.Handler) chi.Router {
    r := chi.NewRouter()
    for _, x := range middlewares {
      r.Use(x)
    }

    return r
}
`
}
const buildFile = (schema: Schema): Code => {
    return {
        fileName: buildFileName(schema.fileName),
        source: `
package ${schema.packageName}

import (
	"context"
	"time"
)

${buildTypes(schema.messages)}
${buildInterfaces(schema)}
`,
    }
}
export default (schemas: Schema[]): Code[] => schemas.map((schema) => buildFile(schema))