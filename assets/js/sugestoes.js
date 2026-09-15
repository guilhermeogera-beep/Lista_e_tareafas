/* Sugestões de grupos prontos, com itens dentro.
   Edite à vontade: cada entrada vira um grupo e cada item vira uma tarefa.
   Item começando com "1:" = basta UMA pessoa levar/fazer (em lista compartilhada vira "um só");
   os outros são "todos" (cada pessoa marca o seu). */
window.SUGESTOES_GRUPOS = [
  {
    nome: 'Documentos', icone: '🛂', tags: ['viagem', 'exterior'],
    itens: ['Passaporte (validade > 6 meses)', 'Visto / ETA / autorização eletrônica', 'RG ou CNH', 'Seguro viagem (apólice impressa)',
      'Passagens aéreas (PDF no celular)', 'Reservas de hotel / hospedagem', 'Cartão internacional desbloqueado', 'Dinheiro em espécie (moeda local)',
      'Certificado de vacinação', 'Cópias dos documentos na nuvem', 'Carteira de motorista internacional (PID)', 'Cartão do seguro / plano de saúde']
  },
  {
    nome: 'Antes de viajar', icone: '🏠', tags: ['viagem'],
    itens: ['Avisar o banco sobre a viagem', 'Ativar roaming ou comprar chip internacional / eSIM', 'Fazer check-in online', 'Baixar mapas offline',
      '1:Deixar chave com alguém de confiança', '1:Desligar gás / geladeira se precisar', '1:Regar plantas / deixar pets com alguém', 'Pagar contas que vencem na viagem',
      'Baixar filmes / músicas offline', 'Conferir peso e medidas da bagagem']
  },
  {
    nome: 'Itens de banho', icone: '🧴', tags: ['viagem', 'camping'],
    itens: ['Escova e pasta de dente', '1:Shampoo e condicionador (frasco pequeno)', '1:Sabonete', 'Desodorante', '1:Protetor solar', 'Hidratante',
      'Fio dental', 'Barbeador / lâmina', 'Absorventes', 'Toalha de rosto', 'Pente / escova de cabelo', '1:Cotonetes', '1:Lenços umedecidos', 'Nécessaire']
  },
  {
    nome: 'Roupas', icone: '👕', tags: ['viagem'],
    itens: ['Camisetas', 'Calças', 'Shorts / bermudas', 'Roupas íntimas', 'Meias', 'Casaco / jaqueta', 'Pijama', 'Roupa de banho',
      'Tênis confortável', 'Chinelo', 'Boné / chapéu', 'Óculos de sol', 'Roupa para ocasião especial', 'Sacola para roupa suja']
  },
  {
    nome: 'Eletrônicos', icone: '🔌', tags: ['viagem', 'camping'],
    itens: ['Celular e carregador', '1:Adaptador de tomada universal', 'Power bank', 'Fones de ouvido', '1:Câmera + cartão de memória', '1:Cabo USB extra',
      'Carregador do relógio', '1:Fita / organizador de cabos', 'Tablet / e-reader']
  },
  {
    nome: 'Farmácia', icone: '💊', tags: ['viagem', 'camping'],
    itens: ['Remédios de uso contínuo (com receita)', '1:Analgésico / antitérmico', '1:Antialérgico', '1:Remédio para enjoo', '1:Remédio para dor de estômago',
      '1:Antidiarreico', '1:Band-aid / curativos', '1:Antisséptico', '1:Repelente', '1:Pomada para picada', '1:Soro fisiológico', '1:Termômetro']
  },
  {
    nome: 'Barraca e dormir', icone: '⛺', tags: ['camping'],
    itens: ['1:Barraca (conferir estacas e cordas)', '1:Lona / footprint para o chão', 'Saco de dormir', 'Isolante térmico / colchonete', 'Travesseiro inflável',
      '1:Martelo de borracha', 'Lanterna de cabeça', '1:Lampião / luz de camping', '1:Pilhas extras', '1:Cobertor extra', '1:Rede (se for usar)']
  },
  {
    nome: 'Cozinha de camping', icone: '🍳', tags: ['camping'],
    itens: ['1:Fogareiro', '1:Gás / cartucho', '1:Isqueiro e fósforo (saco impermeável)', '1:Panela e frigideira', '1:Pratos, copos e talheres', '1:Faca e tábua pequena',
      'Caneca', '1:Esponja e detergente biodegradável', '1:Pano de prato', '1:Saco de lixo', '1:Papel alumínio', '1:Abridor de lata / saca-rolhas', '1:Caixa térmica', '1:Gelo',
      '1:Galão de água', '1:Filtro ou pastilha para água']
  },
  {
    nome: 'Comida de camping', icone: '🥫', tags: ['camping'],
    itens: ['1:Água', '1:Café e filtro', '1:Açúcar / adoçante', '1:Pão', '1:Macarrão instantâneo', '1:Arroz', '1:Enlatados (atum, milho, feijão)', '1:Ovos', '1:Frutas', '1:Barras de cereal', '1:Castanhas / mix', '1:Biscoitos', '1:Marshmallow', '1:Sal, óleo e temperos', '1:Carne para churrasco', '1:Carvão e acendedor']
  },
  {
    nome: 'Equipamento de camping', icone: '🎒', tags: ['camping'],
    itens: ['Mochila', 'Cadeiras dobráveis', '1:Mesa dobrável', '1:Canivete / multiferramenta', '1:Corda / paracord', '1:Fita adesiva (silver tape)', '1:Kit de primeiros socorros',
      'Apito', '1:Bússola / GPS', 'Capa de chuva', 'Sacos estanques', '1:Machadinha / serrote', '1:Pá pequena', 'Garrafa térmica', 'Cantil', 'Toalha de secagem rápida',
      '1:Protetor solar e repelente', '1:Sacos zip para organizar']
  },
  {
    nome: 'Trilha', icone: '🥾', tags: ['camping'],
    itens: ['Bota de trilha', 'Meias de trilha', 'Bastão de caminhada', 'Mochila de ataque', 'Água (mín. 2 L)', 'Lanches leves', '1:Mapa da trilha / GPS',
      'Boné', 'Blusa corta-vento', '1:Kit de primeiros socorros pequeno', 'Lanterna', '1:Saco para o próprio lixo']
  },
  {
    nome: 'Montar acampamento', icone: '📋', tags: ['camping'],
    itens: ['1:Escolher terreno plano e longe de rios', '1:Montar a barraca', '1:Estender lona e isolantes', '1:Organizar a cozinha', '1:Ver onde fica o banheiro / água', '1:Guardar comida protegida de bichos', '1:Recolher lenha (se permitido)', '1:Conferir previsão do tempo']
  },
  {
    nome: 'Desmontar e ir embora', icone: '🧹', tags: ['camping'],
    itens: ['1:Apagar totalmente a fogueira', '1:Recolher todo o lixo', '1:Desmontar e secar a barraca', '1:Conferir se não esqueceu estacas', '1:Devolver o lugar como estava']
  },
  {
    nome: 'Mala de mão', icone: '👜', tags: ['viagem'],
    itens: ['Documentos e passagens', 'Carteira e cartões', 'Celular e carregador', 'Fones', 'Remédios importantes', 'Uma muda de roupa',
      'Itens de higiene básicos (até 100 ml)', 'Garrafa de água vazia', 'Lanche', 'Travesseiro de pescoço', 'Caneta (para formulários)']
  },
  {
    nome: 'Mercado', icone: '🛒', tags: ['casa'],
    itens: ['1:Arroz', '1:Feijão', '1:Macarrão', '1:Óleo', '1:Sal', '1:Açúcar', '1:Café', '1:Leite', '1:Ovos', '1:Pão', '1:Frutas', '1:Verduras', '1:Carne', '1:Frango', '1:Papel higiênico', '1:Detergente', '1:Sabão em pó', '1:Sabonete', '1:Pasta de dente']
  },
  {
    nome: 'Limpeza da casa', icone: '🧽', tags: ['casa'],
    itens: ['1:Lavar louça', '1:Varrer e passar pano', '1:Limpar banheiro', '1:Trocar roupa de cama', '1:Lavar roupa', '1:Tirar o lixo', '1:Limpar geladeira', '1:Aspirar sofá']
  }
];
