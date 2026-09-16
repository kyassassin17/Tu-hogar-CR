export type Coordinates = [number, number]

// Approximate coordinates of each canton head city; used to place listings on the map.
export const cantonsByProvince: Record<string, Record<string, Coordinates>> = {
  'San José': {
    'San José': [9.9333, -84.0833],
    Escazú: [9.9189, -84.1417],
    Desamparados: [9.8981, -84.0661],
    Puriscal: [9.8497, -84.3153],
    Tarrazú: [9.6539, -84.0211],
    Aserrí: [9.8592, -84.0922],
    Mora: [9.9139, -84.2417],
    Goicoechea: [9.9397, -84.0561],
    'Santa Ana': [9.9325, -84.1839],
    Alajuelita: [9.9042, -84.1008],
    'Vázquez de Coronado': [9.9772, -84.0],
    Acosta: [9.7994, -84.1928],
    Tibás: [9.9614, -84.0836],
    Moravia: [9.9583, -84.0511],
    'Montes de Oca': [9.9339, -84.0522],
    Turrubares: [9.8483, -84.4383],
    Dota: [9.6458, -83.9636],
    Curridabat: [9.9178, -84.0333],
    'Pérez Zeledón': [9.3736, -83.7033],
    'León Cortés Castro': [9.6531, -83.9758],
  },
  Alajuela: {
    Alajuela: [10.0162, -84.2116],
    'San Ramón': [10.0897, -84.4717],
    Grecia: [10.0725, -84.3128],
    'San Mateo': [9.9497, -84.5261],
    Atenas: [9.9786, -84.3817],
    Naranjo: [10.0956, -84.3792],
    Palmares: [10.0553, -84.4317],
    Poás: [10.0872, -84.2564],
    Orotina: [9.9078, -84.5242],
    'San Carlos': [10.3236, -84.4275],
    Zarcero: [10.1856, -84.3894],
    Sarchí: [10.0889, -84.3486],
    Upala: [10.8983, -85.0156],
    'Los Chiles': [11.0325, -84.7147],
    Guatuso: [10.6739, -84.8353],
    'Río Cuarto': [10.3406, -84.2119],
  },
  Cartago: {
    Cartago: [9.8644, -83.9194],
    Paraíso: [9.8383, -83.8653],
    'La Unión': [9.9017, -83.9819],
    Jiménez: [9.8956, -83.7594],
    Turrialba: [9.9047, -83.6811],
    Alvarado: [9.9139, -83.8256],
    Oreamuno: [9.8806, -83.9047],
    'El Guarco': [9.8564, -83.9639],
  },
  Heredia: {
    Heredia: [10.0023, -84.1165],
    Barva: [10.0825, -84.1147],
    'Santo Domingo': [9.9833, -84.0894],
    'Santa Bárbara': [10.0333, -84.1583],
    'San Rafael': [10.0164, -84.0847],
    'San Isidro': [10.0333, -84.0167],
    Belén: [9.9836, -84.1867],
    Flores: [9.9964, -84.1594],
    'San Pablo': [9.9967, -84.0908],
    Sarapiquí: [10.4653, -83.9944],
  },
  Guanacaste: {
    Liberia: [10.6333, -85.4375],
    Nicoya: [10.1483, -85.4517],
    'Santa Cruz': [10.2606, -85.5858],
    Bagaces: [10.5256, -85.2531],
    Carrillo: [10.4442, -85.5561],
    Cañas: [10.4306, -85.0925],
    Abangares: [10.2831, -84.95],
    Tilarán: [10.4708, -84.9678],
    Nandayure: [9.9878, -85.2503],
    'La Cruz': [11.0728, -85.6314],
    Hojancha: [9.9089, -85.4139],
  },
  Puntarenas: {
    Puntarenas: [9.9763, -84.8384],
    Esparza: [9.9922, -84.6656],
    'Buenos Aires': [9.1717, -83.3339],
    'Montes de Oro': [10.0947, -84.7297],
    Osa: [8.9583, -83.5228],
    Quepos: [9.4317, -84.1614],
    Golfito: [8.6386, -83.1631],
    'Coto Brus': [8.8206, -82.9714],
    Parrita: [9.5203, -84.3211],
    Corredores: [8.6444, -82.9375],
    Garabito: [9.6144, -84.6289],
    Monteverde: [10.3011, -84.8206],
    'Puerto Jiménez': [8.5333, -83.3],
  },
  Limón: {
    Limón: [9.9907, -83.0359],
    Pococí: [10.2167, -83.7833],
    Siquirres: [10.0972, -83.5058],
    Talamanca: [9.6194, -82.8536],
    Matina: [10.0947, -83.2919],
    Guácimo: [10.2158, -83.6906],
  },
}

export const provinces = Object.keys(cantonsByProvince)

export const provinceCoordinates: Record<string, Coordinates> = {
  'San José': [9.932, -84.084],
  Heredia: [10.002, -84.117],
  Alajuela: [10.016, -84.211],
  Cartago: [9.864, -83.919],
  Guanacaste: [10.633, -85.438],
  Puntarenas: [9.977, -84.834],
  Limón: [9.99, -83.036],
}

export function cantonsOf(province: string) {
  return Object.keys(cantonsByProvince[province] ?? {})
}

export function locationCoordinates(province: string, canton: string): Coordinates | null {
  return cantonsByProvince[province]?.[canton] ?? provinceCoordinates[province] ?? null
}
