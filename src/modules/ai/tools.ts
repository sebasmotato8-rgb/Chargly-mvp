import type Groq from 'groq-sdk';

export const BARBER_TOOLS: Groq.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_services',
      description:
        'Obtiene el catálogo completo de servicios de la barbería: nombre, precio y duración. ' +
        'Llama esto cuando el cliente pregunte por servicios, precios o cuánto tarda un corte.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_availability',
      description:
        'Consulta los horarios disponibles para reservar una cita. ' +
        'Llama esto cuando el cliente quiera agendar y necesites mostrarle opciones de horario. ' +
        'Pide al cliente la fecha deseada antes de llamar esta tool.',
      parameters: {
        type: 'object',
        properties: {
          barber_id: {
            type: 'string',
            description: 'UUID del barbero. Si el cliente no tiene preferencia, usa el primero disponible.',
          },
          service_id: {
            type: 'string',
            description: 'UUID del servicio que el cliente quiere.',
          },
          date: {
            type: 'string',
            description: 'Fecha en formato YYYY-MM-DD.',
          },
        },
        required: ['barber_id', 'service_id', 'date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_appointment',
      description:
        'Crea una nueva cita confirmada. Llama esto SOLO después de que el cliente haya ' +
        'confirmado explícitamente: nombre, teléfono, servicio, barbero, fecha y hora.',
      parameters: {
        type: 'object',
        properties: {
          client_name: {
            type: 'string',
            description: 'Nombre completo del cliente.',
          },
          client_phone: {
            type: 'string',
            description: 'Teléfono en formato E.164, ej: +573001234567.',
          },
          client_email: {
            type: 'string',
            description: 'Email del cliente (opcional).',
          },
          barber_id: {
            type: 'string',
            description: 'UUID del barbero elegido.',
          },
          service_id: {
            type: 'string',
            description: 'UUID del servicio elegido.',
          },
          scheduled_at: {
            type: 'string',
            description: 'Fecha y hora en ISO 8601 con offset, ej: 2024-03-20T10:00:00-05:00.',
          },
          notes: {
            type: 'string',
            description: 'Notas o solicitudes especiales del cliente.',
          },
        },
        required: ['client_name', 'client_phone', 'barber_id', 'service_id', 'scheduled_at'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_appointment',
      description:
        'Cancela una cita existente. El cliente debe proporcionar su teléfono para verificar ' +
        'la cita. Siempre pide confirmación antes de cancelar.',
      parameters: {
        type: 'object',
        properties: {
          appointment_id: {
            type: 'string',
            description: 'UUID de la cita a cancelar.',
          },
          reason: {
            type: 'string',
            description: 'Motivo de la cancelación.',
          },
        },
        required: ['appointment_id', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reschedule_appointment',
      description: 'Reagenda una cita a una nueva fecha y hora.',
      parameters: {
        type: 'object',
        properties: {
          appointment_id: {
            type: 'string',
            description: 'UUID de la cita a reagendar.',
          },
          new_scheduled_at: {
            type: 'string',
            description: 'Nueva fecha y hora en ISO 8601 con offset.',
          },
          barber_id: {
            type: 'string',
            description: 'Nuevo barbero (opcional, si cambia).',
          },
        },
        required: ['appointment_id', 'new_scheduled_at'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_client_appointments',
      description:
        'Busca las citas de un cliente por su número de teléfono. ' +
        'Llama esto cuando el cliente pregunte por sus citas o quiera cancelar/reagendar.',
      parameters: {
        type: 'object',
        properties: {
          client_phone: {
            type: 'string',
            description: 'Teléfono del cliente en formato E.164.',
          },
        },
        required: ['client_phone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_business_info',
      description:
        'Obtiene información general de la barbería: dirección, horarios, teléfono. ' +
        'Llama esto cuando el cliente pregunte cómo llegar, cuándo abren o datos de contacto.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'escalate_to_human',
      description:
        'Escala la conversación a un humano cuando no puedas resolver la solicitud. ' +
        'Llama esto si el cliente está muy frustrado, pide algo fuera de tu alcance ' +
        'o lleva más de 3 intentos sin resolver su problema.',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'Resumen breve de la situación y qué intentó hacer el cliente.',
          },
          reason: {
            type: 'string',
            description: 'Motivo: complex_request | frustrated_client | out_of_scope | repeated_failure',
          },
        },
        required: ['summary', 'reason'],
      },
    },
  },
];
