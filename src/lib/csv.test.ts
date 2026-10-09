import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv'

describe('parseCsv', () => {
  it('lê linhas simples e ignora linhas vazias', () => {
    expect(parseCsv('nome_empresa,cidade\nAcme,SP\n\nBeta,RJ\n')).toEqual([
      ['nome_empresa', 'cidade'],
      ['Acme', 'SP'],
      ['Beta', 'RJ'],
    ])
  })

  it('entende aspas, vírgulas dentro do campo, aspas escapadas e quebra de linha dentro do campo', () => {
    const csv = 'nome_empresa,obs\n"Acme, Ltda","disse ""oi""\nna segunda linha"\n'
    expect(parseCsv(csv)).toEqual([
      ['nome_empresa', 'obs'],
      ['Acme, Ltda', 'disse "oi"\nna segunda linha'],
    ])
  })

  it('detecta ponto e vírgula (planilhas em português) e remove o BOM', () => {
    expect(parseCsv('﻿nome_empresa;cidade\r\nAcme;São Paulo\r\n')).toEqual([
      ['nome_empresa', 'cidade'],
      ['Acme', 'São Paulo'],
    ])
  })

  it('aceita arquivo sem quebra de linha final', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})
