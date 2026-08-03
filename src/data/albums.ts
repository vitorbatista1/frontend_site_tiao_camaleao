export interface Album {
  id: string;
  title: string;
  price: string;
  audioUrl: string;
  tracks: string[];
}

export const defaultAlbums: Album[] = [
  {
    id: 'album1',
    title: 'Álbum 1',
    price: 'R$ 47,00',
    audioUrl: '',
    tracks: [
      "Apresentação",
      "Ciranda Cirandinha — personalizada",
      "Bote Aqui o Seu Pezinho — personalizada",
      "O Sapo Não Lava o Pé",
      "Alecrim Dourado — personalizada",
      "10 Indiozinhos — personalizada",
      "Cai Cai Balão",
      "Marcha Soldado — personalizada",
      "Samba Lelê — personalizada",
      "Dona Aranha",
      "Fonte do Tororó — personalizada",
    ],
  },
  {
    id: 'album2',
    title: 'Álbum 2',
    price: 'R$ 47,00',
    audioUrl: '',
    tracks: [
      "Apresentação",
      "Sabiá na Gaiola — personalizada",
      "Sapo Jururu — personalizada",
      "Formiguinha",
      "Peixe Vivo — personalizada",
      "Meu Limão, Meu Limoeiro — personalizada",
      "Pai Francisco — personalizada",
      "Escravos de Jó",
      "Pirulito que Bate-Bate — personalizada",
      "Se Essa Rua Fosse Minha — personalizada",
    ],
  },
  {
    id: 'album3',
    title: 'Álbum 3',
    price: 'R$ 47,00',
    audioUrl: '',
    tracks: [
      "Apresentação",
      "Cantiga 1 — personalizada",
      "Cantiga 2 — personalizada",
      "Cantiga 3",
      "Cantiga 4 — personalizada",
      "Cantiga 5 — personalizada",
      "Cantiga 6",
      "Cantiga 7 — personalizada",
      "Cantiga 8 — personalizada",
      "Cantiga 9",
    ],
  },
];

export const campaignDefaults: Record<string, string[]> = {
  campanha1: ['album1', 'album2'],
  campanha2: ['album1', 'album2', 'album3'],
};
