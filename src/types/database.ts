export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      campanhas: {
        Row: {
          atualizado_em: string
          canais: string[] | null
          cargos_alvo: string[] | null
          criado_em: string
          criterios_exclusao: Json | null
          criterios_qualificacao: Json | null
          fontes: string[] | null
          id: string
          nome: string
          persona_argumentos: string[] | null
          persona_nome: string | null
          persona_objecoes: Json | null
          persona_produto: string | null
          persona_tom: string | null
          playbook_id: string | null
          regioes: string[] | null
          score_minimo: number
          segmento: string | null
          status: string
          volume_semanal: number | null
          workspace_id: string
        }
        Insert: {
          atualizado_em?: string
          canais?: string[] | null
          cargos_alvo?: string[] | null
          criado_em?: string
          criterios_exclusao?: Json | null
          criterios_qualificacao?: Json | null
          fontes?: string[] | null
          id?: string
          nome: string
          persona_argumentos?: string[] | null
          persona_nome?: string | null
          persona_objecoes?: Json | null
          persona_produto?: string | null
          persona_tom?: string | null
          playbook_id?: string | null
          regioes?: string[] | null
          score_minimo?: number
          segmento?: string | null
          status?: string
          volume_semanal?: number | null
          workspace_id: string
        }
        Update: {
          atualizado_em?: string
          canais?: string[] | null
          cargos_alvo?: string[] | null
          criado_em?: string
          criterios_exclusao?: Json | null
          criterios_qualificacao?: Json | null
          fontes?: string[] | null
          id?: string
          nome?: string
          persona_argumentos?: string[] | null
          persona_nome?: string | null
          persona_objecoes?: Json | null
          persona_produto?: string | null
          persona_tom?: string | null
          playbook_id?: string | null
          regioes?: string[] | null
          score_minimo?: number
          segmento?: string | null
          status?: string
          volume_semanal?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanhas_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      custos_uso: {
        Row: {
          criado_em: string
          custo_usd: number
          id: string
          modelo: string
          origem: string
          prospect_id: string | null
          tokens_in: number
          tokens_out: number
          workspace_id: string
        }
        Insert: {
          criado_em?: string
          custo_usd?: number
          id?: string
          modelo: string
          origem: string
          prospect_id?: string | null
          tokens_in?: number
          tokens_out?: number
          workspace_id: string
        }
        Update: {
          criado_em?: string
          custo_usd?: number
          id?: string
          modelo?: string
          origem?: string
          prospect_id?: string | null
          tokens_in?: number
          tokens_out?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custos_uso_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custos_uso_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      fila_acoes: {
        Row: {
          aprovada_em: string | null
          aprovada_por: string | null
          campanha_id: string
          canal: string
          criado_em: string
          erro_execucao: string | null
          executada_em: string | null
          expira_em: string | null
          fluxo_automatico_id: string | null
          id: string
          mensagem: string
          mensagem_editada: string | null
          prospect_id: string
          razao: string
          status: string
          tipo: string
          workspace_id: string
        }
        Insert: {
          aprovada_em?: string | null
          aprovada_por?: string | null
          campanha_id: string
          canal: string
          criado_em?: string
          erro_execucao?: string | null
          executada_em?: string | null
          expira_em?: string | null
          fluxo_automatico_id?: string | null
          id?: string
          mensagem: string
          mensagem_editada?: string | null
          prospect_id: string
          razao: string
          status?: string
          tipo: string
          workspace_id: string
        }
        Update: {
          aprovada_em?: string | null
          aprovada_por?: string | null
          campanha_id?: string
          canal?: string
          criado_em?: string
          erro_execucao?: string | null
          executada_em?: string | null
          expira_em?: string | null
          fluxo_automatico_id?: string | null
          id?: string
          mensagem?: string
          mensagem_editada?: string | null
          prospect_id?: string
          razao?: string
          status?: string
          tipo?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fila_acoes_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fila_acoes_fluxo_automatico_id_fkey"
            columns: ["fluxo_automatico_id"]
            isOneToOne: false
            referencedRelation: "fluxos_automaticos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fila_acoes_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fila_acoes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      fluxos_automaticos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          campanha_id: string | null
          canal_acao: string
          condicao: Json
          criado_em: string
          delay_horas: number | null
          descricao: string | null
          id: string
          nome: string
          taxa_sucesso: number | null
          template_mensagem: string
          tipo_acao: string
          total_execucoes: number | null
          total_respostas: number | null
          workspace_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          campanha_id?: string | null
          canal_acao: string
          condicao: Json
          criado_em?: string
          delay_horas?: number | null
          descricao?: string | null
          id?: string
          nome: string
          taxa_sucesso?: number | null
          template_mensagem: string
          tipo_acao: string
          total_execucoes?: number | null
          total_respostas?: number | null
          workspace_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          campanha_id?: string | null
          canal_acao?: string
          condicao?: Json
          criado_em?: string
          delay_horas?: number | null
          descricao?: string | null
          id?: string
          nome?: string
          taxa_sucesso?: number | null
          template_mensagem?: string
          tipo_acao?: string
          total_execucoes?: number | null
          total_respostas?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fluxos_automaticos_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fluxos_automaticos_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integracoes: {
        Row: {
          ativo: boolean
          atualizado_em: string
          config: Json
          criado_em: string
          id: string
          tipo: string
          workspace_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          config?: Json
          criado_em?: string
          id?: string
          tipo: string
          workspace_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          config?: Json
          criado_em?: string
          id?: string
          tipo?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integracoes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_qualificados: {
        Row: {
          atualizado_em: string
          briefing: Json
          calcom_booking_id: string | null
          crm_lead_id: string | null
          crm_webhook_enviado: boolean | null
          crm_webhook_enviado_em: string | null
          id: string
          prospect_id: string
          proximo_passo: string | null
          qualificado_em: string
          reuniao_em: string | null
          score_temperatura: number | null
          status_reuniao: string | null
          workspace_id: string
        }
        Insert: {
          atualizado_em?: string
          briefing?: Json
          calcom_booking_id?: string | null
          crm_lead_id?: string | null
          crm_webhook_enviado?: boolean | null
          crm_webhook_enviado_em?: string | null
          id?: string
          prospect_id: string
          proximo_passo?: string | null
          qualificado_em?: string
          reuniao_em?: string | null
          score_temperatura?: number | null
          status_reuniao?: string | null
          workspace_id: string
        }
        Update: {
          atualizado_em?: string
          briefing?: Json
          calcom_booking_id?: string | null
          crm_lead_id?: string | null
          crm_webhook_enviado?: boolean | null
          crm_webhook_enviado_em?: string | null
          id?: string
          prospect_id?: string
          proximo_passo?: string | null
          qualificado_em?: string
          reuniao_em?: string | null
          score_temperatura?: number | null
          status_reuniao?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_qualificados_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: true
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_qualificados_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      playbooks: {
        Row: {
          ativo: boolean
          canais_padrao: string[] | null
          criado_em: string
          criterios_qualificacao_padrao: Json | null
          descricao: string | null
          fontes_padrao: string[] | null
          icone: string | null
          icp_padrao: Json | null
          id: string
          nome: string
          persona_padrao: Json | null
        }
        Insert: {
          ativo?: boolean
          canais_padrao?: string[] | null
          criado_em?: string
          criterios_qualificacao_padrao?: Json | null
          descricao?: string | null
          fontes_padrao?: string[] | null
          icone?: string | null
          icp_padrao?: Json | null
          id?: string
          nome: string
          persona_padrao?: Json | null
        }
        Update: {
          ativo?: boolean
          canais_padrao?: string[] | null
          criado_em?: string
          criterios_qualificacao_padrao?: Json | null
          descricao?: string | null
          fontes_padrao?: string[] | null
          icone?: string | null
          icp_padrao?: Json | null
          id?: string
          nome?: string
          persona_padrao?: Json | null
        }
        Relationships: []
      }
      prospect_estado: {
        Row: {
          aguardando: string | null
          atualizado_em: string
          contexto_resumo: string | null
          id: string
          prospect_id: string
          proxima_acao_em: string | null
          tentativas_email: number | null
          tentativas_instagram: number | null
          tentativas_linkedin: number | null
          tentativas_whatsapp: number | null
        }
        Insert: {
          aguardando?: string | null
          atualizado_em?: string
          contexto_resumo?: string | null
          id?: string
          prospect_id: string
          proxima_acao_em?: string | null
          tentativas_email?: number | null
          tentativas_instagram?: number | null
          tentativas_linkedin?: number | null
          tentativas_whatsapp?: number | null
        }
        Update: {
          aguardando?: string | null
          atualizado_em?: string
          contexto_resumo?: string | null
          id?: string
          prospect_id?: string
          proxima_acao_em?: string | null
          tentativas_email?: number | null
          tentativas_instagram?: number | null
          tentativas_linkedin?: number | null
          tentativas_whatsapp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_estado_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: true
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_interacoes: {
        Row: {
          canal: string
          conteudo: string
          direcao: string
          enviado_em: string
          id: string
          metadata: Json | null
          prospect_id: string
          status: string | null
          tipo: string
        }
        Insert: {
          canal: string
          conteudo: string
          direcao: string
          enviado_em?: string
          id?: string
          metadata?: Json | null
          prospect_id: string
          status?: string | null
          tipo?: string
        }
        Update: {
          canal?: string
          conteudo?: string
          direcao?: string
          enviado_em?: string
          id?: string
          metadata?: Json | null
          prospect_id?: string
          status?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_interacoes_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          atualizado_em: string
          campanha_id: string
          canal_principal: string | null
          cargo: string | null
          cidade: string | null
          cnpj: string | null
          criado_em: string
          dados_enriquecimento: Json | null
          email: string | null
          enriched_at: string | null
          estado: string | null
          fonte: string | null
          fonte_id: string | null
          id: string
          instagram_handle: string | null
          linkedin_url: string | null
          nome_contato: string | null
          nome_empresa: string
          primeiro_contato_em: string | null
          score: number | null
          score_detalhes: Json | null
          segmento: string | null
          sinais_timing: Json | null
          status: string
          ultima_interacao_em: string | null
          website: string | null
          whatsapp: string | null
          workspace_id: string
        }
        Insert: {
          atualizado_em?: string
          campanha_id: string
          canal_principal?: string | null
          cargo?: string | null
          cidade?: string | null
          cnpj?: string | null
          criado_em?: string
          dados_enriquecimento?: Json | null
          email?: string | null
          enriched_at?: string | null
          estado?: string | null
          fonte?: string | null
          fonte_id?: string | null
          id?: string
          instagram_handle?: string | null
          linkedin_url?: string | null
          nome_contato?: string | null
          nome_empresa: string
          primeiro_contato_em?: string | null
          score?: number | null
          score_detalhes?: Json | null
          segmento?: string | null
          sinais_timing?: Json | null
          status?: string
          ultima_interacao_em?: string | null
          website?: string | null
          whatsapp?: string | null
          workspace_id: string
        }
        Update: {
          atualizado_em?: string
          campanha_id?: string
          canal_principal?: string | null
          cargo?: string | null
          cidade?: string | null
          cnpj?: string | null
          criado_em?: string
          dados_enriquecimento?: Json | null
          email?: string | null
          enriched_at?: string | null
          estado?: string | null
          fonte?: string | null
          fonte_id?: string | null
          id?: string
          instagram_handle?: string | null
          linkedin_url?: string | null
          nome_contato?: string | null
          nome_empresa?: string
          primeiro_contato_em?: string | null
          score?: number | null
          score_detalhes?: Json | null
          segmento?: string | null
          sinais_timing?: Json | null
          status?: string
          ultima_interacao_em?: string | null
          website?: string | null
          whatsapp?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospects_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_usuarios: {
        Row: {
          criado_em: string
          id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_usuarios_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          id: string
          nome: string
          plano: string
          slug: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome: string
          plano?: string
          slug: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome?: string
          plano?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_workspace_ids_for_user: { Args: never; Returns: string[] }
      is_super_admin: { Args: never; Returns: boolean }
      metricas_resumo: { Args: { dias?: number }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
