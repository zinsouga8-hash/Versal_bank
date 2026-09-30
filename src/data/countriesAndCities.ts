export interface CountryData {
  name: string;
  code: string;
  prefix: string;
  flag: string;
  cities: string[];
}

export const WORLD_COUNTRIES: CountryData[] = [
  {
    name: 'France',
    code: 'FR',
    prefix: '+33',
    flag: '🇫🇷',
    cities: [
      'Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Montpellier', 
      'Strasbourg', 'Bordeaux', 'Lille', 'Rennes', 'Reims', 'Saint-Étienne', 
      'Toulon', 'Le Havre', 'Grenoble', 'Dijon', 'Angers', 'Nîmes', 'Aix-en-Provence',
      'Brest', 'Le Mans', 'Amiens', 'Tours', 'Limoges', 'Clermont-Ferrand', 'Perpignan'
    ]
  },
  {
    name: 'Canada',
    code: 'CA',
    prefix: '+1',
    flag: '🇨🇦',
    cities: [
      'Toronto', 'Montréal', 'Vancouver', 'Calgary', 'Edmonton', 'Ottawa', 
      'Winnipeg', 'Québec', 'Hamilton', 'Kitchener', 'London', 'Victoria', 
      'Halifax', 'Oshawa', 'Windsor', 'Saskatoon', 'Regina', 'Sherbrooke', 
      'Trois-Rivières', 'Gatineau', 'Laval', 'Longueuil', 'St. John\'s'
    ]
  },
  {
    name: 'Bénin',
    code: 'BJ',
    prefix: '+229',
    flag: '🇧🇯',
    cities: [
      'Cotonou', 'Porto-Novo', 'Parakou', 'Abomey-Calavi', 'Djougou', 'Bohicon', 
      'Natitingou', 'Ouidah', 'Kandi', 'Lokossa', 'Malanville', 'Comè', 
      'Abomey', 'Dassa-Zoumè', 'Allada', 'Savalou', 'Pobè', 'Tanguiéta'
    ]
  },
  {
    name: 'Côte d\'Ivoire',
    code: 'CI',
    prefix: '+225',
    flag: '🇨🇮',
    cities: [
      'Abidjan', 'Bouaké', 'Daloa', 'Yamoussoukro', 'San-Pédro', 'Korhogo', 
      'Man', 'Divo', 'Gagnoa', 'Abengourou', 'Anyama', 'Soubré', 'Grand-Bassam', 
      'Dabou', 'Agboville', 'Bingerville', 'Séguéla', 'Bondoukou'
    ]
  },
  {
    name: 'Sénégal',
    code: 'SN',
    prefix: '+221',
    flag: '🇸🇳',
    cities: [
      'Dakar', 'Touba', 'Thiès', 'Rufisque', 'Kaolack', 'M\'Bour', 'Ziguinchor', 
      'Saint-Louis', 'Diourbel', 'Louga', 'Tambacounda', 'Kolda', 'Mbacké', 
      'Tivaouane', 'Richard-Toll', 'Kédougou', 'Fatick'
    ]
  },
  {
    name: 'Cameroun',
    code: 'CM',
    prefix: '+237',
    flag: '🇨🇲',
    cities: [
      'Douala', 'Yaoundé', 'Garoua', 'Bamenda', 'Maroua', 'Bafoussam', 
      'Ngaoundéré', 'Bertoua', 'Loum', 'Kumba', 'Edéa', 'Kribi', 'Foumban', 
      'Dschang', 'Ebolowa', 'Limbe'
    ]
  },
  {
    name: 'Belgique',
    code: 'BE',
    prefix: '+32',
    flag: '🇧🇪',
    cities: [
      'Bruxelles', 'Anvers', 'Gand', 'Charleroi', 'Liège', 'Bruges', 
      'Namur', 'Louvain', 'Mons', 'Alost', 'Malines', 'Ostende', 'Tournai', 
      'Courtrai', 'Verviers', 'Hasselt'
    ]
  },
  {
    name: 'Suisse',
    code: 'CH',
    prefix: '+41',
    flag: '🇨🇭',
    cities: [
      'Genève', 'Zurich', 'Bâle', 'Lausanne', 'Berne', 'Winterthour', 
      'Lucerne', 'Saint-Gall', 'Lugano', 'Bienne', 'Thoune', 'Fribourg', 
      'Neuchâtel', 'Sion', 'Yverdon-les-Bains'
    ]
  },
  {
    name: 'États-Unis',
    code: 'US',
    prefix: '+1',
    flag: '🇺🇸',
    cities: [
      'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphie', 
      'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville', 
      'San Francisco', 'Miami', 'Atlanta', 'Boston', 'Seattle', 'Washington D.C.',
      'Denver', 'Las Vegas', 'Detroit', 'Orlando'
    ]
  },
  {
    name: 'Allemagne',
    code: 'DE',
    prefix: '+49',
    flag: '🇩🇪',
    cities: [
      'Berlin', 'Hambourg', 'Munich', 'Cologne', 'Francfort-sur-le-Main', 
      'Stuttgart', 'Düsseldorf', 'Leipzig', 'Dortmund', 'Essen', 'Brême', 
      'Dresde', 'Hanovre', 'Nuremberg', 'Duisbourg', 'Bonn'
    ]
  },
  {
    name: 'Royaume-Uni',
    code: 'GB',
    prefix: '+44',
    flag: '🇬🇧',
    cities: [
      'Londres', 'Birmingham', 'Manchester', 'Glasgow', 'Liverpool', 'Newcastle', 
      'Sheffield', 'Bristol', 'Leeds', 'Édimbourg', 'Belfast', 'Cardiff', 
      'Nottingham', 'Southampton', 'Leicester'
    ]
  },
  {
    name: 'Maroc',
    code: 'MA',
    prefix: '+212',
    flag: '🇲🇦',
    cities: [
      'Casablanca', 'Rabat', 'Fès', 'Tanger', 'Marrakech', 'Salé', 'Meknès', 
      'Agadir', 'Oujda', 'Kénitra', 'Tétouan', 'Safi', 'Mohammédia', 'Nador', 
      'Béni Mellal', 'El Jadida'
    ]
  },
  {
    name: 'Algérie',
    code: 'DZ',
    prefix: '+213',
    flag: '🇩🇿',
    cities: [
      'Alger', 'Oran', 'Constantine', 'Annaba', 'Blida', 'Batna', 'Djelfa', 
      'Sétif', 'Sidi Bel Abbès', 'Biskra', 'Tébessa', 'El Oued', 'Skikda', 
      'Tiaret', 'Béjaïa', 'Tlemcen', 'Tizi Ouzou'
    ]
  },
  {
    name: 'Tunisie',
    code: 'TN',
    prefix: '+216',
    flag: '🇹🇳',
    cities: [
      'Tunis', 'Sfax', 'Sousse', 'Kairouan', 'Bizerte', 'Gabès', 'Ariana', 
      'Gafsa', 'La Marsa', 'Monastir', 'Ben Arous', 'Kasserine', 'Médenine', 
      'Nabeul', 'Tataouine', 'Hammamet', 'Djerba'
    ]
  },
  {
    name: 'Togo',
    code: 'TG',
    prefix: '+228',
    flag: '🇹🇬',
    cities: [
      'Lomé', 'Sokodé', 'Kara', 'Kpalimé', 'Atakpamé', 'Bassar', 'Tsévié', 
      'Aného', 'Mango', 'Dapaong', 'Niamtougou', 'Tabligbo'
    ]
  },
  {
    name: 'Burkina Faso',
    code: 'BF',
    prefix: '+226',
    flag: '🇧🇫',
    cities: [
      'Ouagadougou', 'Bobo-Dioulasso', 'Koudougou', 'Ouahigouya', 'Banfora', 
      'Dédougou', 'Kaya', 'Dori', 'Tenkodogo', 'Fada N\'Gourma', 'Gaoua'
    ]
  },
  {
    name: 'Mali',
    code: 'ML',
    prefix: '+223',
    flag: '🇲🇱',
    cities: [
      'Bamako', 'Sikasso', 'Mopti', 'Koutiala', 'Kayes', 'Ségou', 
      'Gao', 'Tombouctou', 'San', 'Kati', 'Bougouni', 'Kidal'
    ]
  },
  {
    name: 'Guinée',
    code: 'GN',
    prefix: '+224',
    flag: '🇬🇳',
    cities: [
      'Conakry', 'Nzérékoré', 'Kankan', 'Kindia', 'Labé', 'Mamou', 
      'Boké', 'Faranah', 'Coyah', 'Kissidougou', 'Guéckédou'
    ]
  },
  {
    name: 'Gabon',
    code: 'GA',
    prefix: '+241',
    flag: '🇬🇦',
    cities: [
      'Libreville', 'Port-Gentil', 'Franceville', 'Oyem', 'Moanda', 
      'Mouila', 'Lambaréné', 'Tchibanga', 'Koulamoutou', 'Makokou'
    ]
  },
  {
    name: 'Congo-Brazzaville',
    code: 'CG',
    prefix: '+242',
    flag: '🇨🇬',
    cities: [
      'Brazzaville', 'Pointe-Noire', 'Dolisie', 'Nkayi', 'Owando', 
      'Ouésso', 'Impfondo', 'Madingou', 'Kinkala'
    ]
  },
  {
    name: 'République Démocratique du Congo',
    code: 'CD',
    prefix: '+243',
    flag: '🇨🇩',
    cities: [
      'Kinshasa', 'Lubumbashi', 'Mbuji-Mayi', 'Kananga', 'Kisangani', 
      'Bukavu', 'Goma', 'Tshikapa', 'Kolwezi', 'Likasi', 'Kikwit', 'Matadi'
    ]
  },
  {
    name: 'Madagascar',
    code: 'MG',
    prefix: '+261',
    flag: '🇲🇬',
    cities: [
      'Antananarivo', 'Toamasina', 'Antsirabe', 'Mahajanga', 'Fianarantsoa', 
      'Toliara', 'Antsiranana', 'Ambovombe', 'Morondava', 'Nosy Be'
    ]
  },
  {
    name: 'Afrique du Sud',
    code: 'ZA',
    prefix: '+27',
    flag: '🇿🇦',
    cities: [
      'Johannesburg', 'Le Cap', 'Durban', 'Pretoria', 'Port Elizabeth', 
      'Bloemfontein', 'East London', 'Nelspruit', 'Kimberley', 'Polokwane'
    ]
  },
  {
    name: 'Espagne',
    code: 'ES',
    prefix: '+34',
    flag: '🇪🇸',
    cities: [
      'Madrid', 'Barcelone', 'Valence', 'Séville', 'Saragosse', 'Malaga', 
      'Murcie', 'Palma de Majorque', 'Las Palmas', 'Bilbao', 'Alicante', 'Cordoue'
    ]
  },
  {
    name: 'Italie',
    code: 'IT',
    prefix: '+39',
    flag: '🇮🇹',
    cities: [
      'Rome', 'Milan', 'Naples', 'Turin', 'Palerme', 'Gênes', 
      'Bologne', 'Florence', 'Bari', 'Catane', 'Venise', 'Vérone'
    ]
  },
  {
    name: 'Portugal',
    code: 'PT',
    prefix: '+351',
    flag: '🇵🇹',
    cities: [
      'Lisbonne', 'Porto', 'Vila Nova de Gaia', 'Amadora', 'Braga', 
      'Funchal', 'Coimbra', 'Setúbal', 'Almada', 'Faro'
    ]
  },
  {
    name: 'Pays-Bas',
    code: 'NL',
    prefix: '+31',
    flag: '🇳🇱',
    cities: [
      'Amsterdam', 'Rotterdam', 'La Haye', 'Utrecht', 'Eindhoven', 
      'Groningue', 'Tilbourg', 'Almere', 'Breda', 'Nimègue'
    ]
  },
  {
    name: 'Luxembourg',
    code: 'LU',
    prefix: '+352',
    flag: '🇱🇺',
    cities: [
      'Luxembourg', 'Esch-sur-Alzette', 'Differdange', 'Dudelange', 
      'Ettelbruck', 'Diekirch', 'Wiltz', 'Echternach'
    ]
  },
  {
    name: 'Australie',
    code: 'AU',
    prefix: '+61',
    flag: '🇦🇺',
    cities: [
      'Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adélaïde', 
      'Gold Coast', 'Canberra', 'Newcastle', 'Wollongong', 'Hobart'
    ]
  },
  {
    name: 'Brésil',
    code: 'BR',
    prefix: '+55',
    flag: '🇧🇷',
    cities: [
      'São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador', 'Fortaleza', 
      'Belo Horizonte', 'Manaus', 'Curitiba', 'Recife', 'Porto Alegre'
    ]
  },
  {
    name: 'Chine',
    code: 'CN',
    prefix: '+86',
    flag: '🇨🇳',
    cities: [
      'Pékin', 'Shanghai', 'Shenzhen', 'Guangzhou', 'Chengdu', 
      'Wuhan', 'Hangzhou', 'Chongqing', 'Nankin', 'Tianjin'
    ]
  },
  {
    name: 'Japon',
    code: 'JP',
    prefix: '+81',
    flag: '🇯🇵',
    cities: [
      'Tokyo', 'Yokohama', 'Osaka', 'Nagoya', 'Sapporo', 
      'Fukuoka', 'Kobe', 'Kyoto', 'Kawasaki', 'Saitama'
    ]
  },
  {
    name: 'Émirats Arabes Unis',
    code: 'AE',
    prefix: '+971',
    flag: '🇦🇪',
    cities: [
      'Dubaï', 'Abou Dabi', 'Charjah', 'Al-Aïn', 'Ajman', 
      'Ras el Khaïmah', 'Fujaïrah', 'Oumm al Qaïwaïn'
    ]
  },
  {
    name: 'Arabie Saoudite',
    code: 'SA',
    prefix: '+966',
    flag: '🇸🇦',
    cities: [
      'Riyad', 'Djeddah', 'La Mecque', 'Médine', 'Dammam', 
      'Al-Khobar', 'Tabouk', 'Buraidah', 'Abha'
    ]
  },
  {
    name: 'Liban',
    code: 'LB',
    prefix: '+961',
    flag: '🇱🇧',
    cities: ['Beyrouth', 'Tripoli', 'Sidon', 'Tyr', 'Jounieh', 'Zahlé', 'Byblos', 'Baalbek']
  },
  {
    name: 'Haïti',
    code: 'HT',
    prefix: '+509',
    flag: '🇭🇹',
    cities: [
      'Port-au-Prince', 'Carrefour', 'Delmas', 'Cap-Haïtien', 'Pétion-Ville', 
      'Gonaïves', 'Saint-Marc', 'Les Cayes', 'Port-de-Paix', 'Jacmel'
    ]
  },
  {
    name: 'Niger',
    code: 'NE',
    prefix: '+227',
    flag: '🇳🇪',
    cities: ['Niamey', 'Maradi', 'Zinder', 'Tahoua', 'Agadez', 'Arlit', 'Dosso', 'Diffa']
  },
  {
    name: 'Tchad',
    code: 'TD',
    prefix: '+235',
    flag: '🇹🇩',
    cities: ['N\'Djaména', 'Moundou', 'Sarh', 'Abéché', 'Kélo', 'Koumra', 'Pala', 'Am Timan']
  },
  {
    name: 'Centrafrique',
    code: 'CF',
    prefix: '+236',
    flag: '🇨🇫',
    cities: ['Bangui', 'Bimbo', 'Bégoua', 'Berbérati', 'Carnot', 'Bambari', 'Bouar']
  },
  {
    name: 'Mauritanie',
    code: 'MR',
    prefix: '+222',
    flag: '🇲🇷',
    cities: ['Nouakchott', 'Nouadhibou', 'Kiffa', 'Rosso', 'Kaédi', 'Zouérat', 'Atar']
  },
  {
    name: 'Rwanda',
    code: 'RW',
    prefix: '+250',
    flag: '🇷🇼',
    cities: ['Kigali', 'Butare', 'Gisenyi', 'Ruhengeri', 'Byumba', 'Cyangugu', 'Kibuye']
  },
  {
    name: 'Burundi',
    code: 'BI',
    prefix: '+257',
    flag: '🇧🇮',
    cities: ['Bujumbura', 'Gitega', 'Ngozi', 'Rumonge', 'Kayanza', 'Bururi']
  },
  {
    name: 'Mexique',
    code: 'MX',
    prefix: '+52',
    flag: '🇲🇽',
    cities: ['Mexico', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'Cancún', 'Mérida']
  },
  {
    name: 'Inde',
    code: 'IN',
    prefix: '+91',
    flag: '🇮🇳',
    cities: ['New Delhi', 'Mumbai', 'Bangalore', 'Hyderabad', 'Chennai', 'Calcutta', 'Ahmedabad']
  },
  {
    name: 'Turquie',
    code: 'TR',
    prefix: '+90',
    flag: '🇹🇷',
    cities: ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya', 'Adana', 'Gaziantep']
  },
  {
    name: 'Suède',
    code: 'SE',
    prefix: '+46',
    flag: '🇸🇪',
    cities: ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro']
  },
  {
    name: 'Norvège',
    code: 'NO',
    prefix: '+47',
    flag: '🇳🇴',
    cities: ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Drammen', 'Fredrikstad']
  },
  {
    name: 'Danemark',
    code: 'DK',
    prefix: '+45',
    flag: '🇩🇰',
    cities: ['Copenhague', 'Aarhus', 'Odense', 'Aalborg', 'Esbjerg', 'Randers']
  },
  {
    name: 'Irlande',
    code: 'IE',
    prefix: '+353',
    flag: '🇮🇪',
    cities: ['Dublin', 'Cork', 'Limerick', 'Galway', 'Waterford', 'Drogheda']
  },
  {
    name: 'Autriche',
    code: 'AT',
    prefix: '+43',
    flag: '🇦🇹',
    cities: ['Vienne', 'Graz', 'Linz', 'Salzbourg', 'Innsbruck', 'Klagenfurt']
  },
  {
    name: 'Pologne',
    code: 'PL',
    prefix: '+48',
    flag: '🇵🇱',
    cities: ['Varsovie', 'Cracovie', 'Łódź', 'Wrocław', 'Poznań', 'Gdańsk']
  },
  {
    name: 'Grèce',
    code: 'GR',
    prefix: '+30',
    flag: '🇬🇷',
    cities: ['Athènes', 'Thessalonique', 'Patras', 'Héraklion', 'Larissa', 'Volos']
  },
  {
    name: 'Russie',
    code: 'RU',
    prefix: '+7',
    flag: '🇷🇺',
    cities: ['Moscou', 'Saint-Pétersbourg', 'Novossibirsk', 'Iekaterinbourg', 'Kazan']
  },
  {
    name: 'Singapour',
    code: 'SG',
    prefix: '+65',
    flag: '🇸🇬',
    cities: ['Singapour']
  },
  {
    name: 'Nouvelle-Zélande',
    code: 'NZ',
    prefix: '+64',
    flag: '🇳🇿',
    cities: ['Auckland', 'Wellington', 'Christchurch', 'Hamilton', 'Tauranga', 'Dunedin']
  },
  {
    name: 'Argentine',
    code: 'AR',
    prefix: '+54',
    flag: '🇦🇷',
    cities: ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'La Plata', 'Tucumán']
  },
  {
    name: 'Chili',
    code: 'CL',
    prefix: '+56',
    flag: '🇨🇱',
    cities: ['Santiago', 'Valparaíso', 'Concepción', 'La Serena', 'Antofagasta']
  },
  {
    name: 'Colombie',
    code: 'CO',
    prefix: '+57',
    flag: '🇨🇴',
    cities: ['Bogota', 'Medellín', 'Cali', 'Barranquilla', 'Carthagène', 'Bucaramanga']
  },
  {
    name: 'Pérou',
    code: 'PE',
    prefix: '+51',
    flag: '🇵🇪',
    cities: ['Lima', 'Arequipa', 'Trujillo', 'Chiclayo', 'Piura', 'Cusco']
  }
];

// Fallback list of generic other countries to cover all remaining territories in the world
const OTHER_COUNTRIES = [
  'Afghanistan', 'Albanie', 'Andorre', 'Angola', 'Antigua-et-Barbuda', 'Arménie', 'Azerbaïdjan',
  'Bahamas', 'Bahreïn', 'Bangladesh', 'Barbade', 'Belize', 'Bhoutan', 'Biélorussie', 'Birmanie',
  'Bolivie', 'Bosnie-Herzégovine', 'Botswana', 'Brunei', 'Bulgarie', 'Cap-Vert', 'Cambodge',
  'Chypre', 'Comores', 'Corée du Nord', 'Corée du Sud', 'Costa Rica', 'Croatie', 'Cuba', 'Djibouti',
  'Dominique', 'Égypte', 'Équateur', 'Érythrée', 'Estonie', 'Eswatini', 'Éthiopie', 'Fidji',
  'Finlande', 'Gambie', 'Géorgie', 'Ghana', 'Grenade', 'Guatemala', 'Guinée-Bissau', 'Guinée équatoriale',
  'Guyana', 'Honduras', 'Hongrie', 'Îles Cook', 'Îles Marshall', 'Îles Salomon', 'Indonésie', 'Irak',
  'Iran', 'Islande', 'Israël', 'Jamaïque', 'Jordanie', 'Kazakhstan', 'Kenya', 'Kirghizistan',
  'Kiribati', 'Koweït', 'Laos', 'Lesotho', 'Lettonie', 'Libéria', 'Libye', 'Liechtenstein', 'Lituanie',
  'Macédoine du Nord', 'Malaisie', 'Malawi', 'Maldives', 'Malte', 'Maurice', 'Micronésie', 'Moldavie',
  'Monaco', 'Mongolie', 'Monténégro', 'Mozambique', 'Namibie', 'Nauru', 'Népal', 'Nicaragua', 'Nigéria',
  'Oman', 'Ouganda', 'Ouzbékistan', 'Pakistan', 'Palaos', 'Panama', 'Papouasie-Nouvelle-Guinée',
  'Paraguay', 'Philippines', 'Pologne', 'Qatar', 'République Dominicaine', 'République tchèque',
  'Roumanie', 'Saint-Christophe-et-Niévès', 'Sainte-Lucie', 'Saint-Marin', 'Saint-Vincent-et-les-Grenadines',
  'Salomon', 'Salvador', 'Samoa', 'Sao Tomé-et-Principe', 'Serbie', 'Seychelles', 'Sierra Leone',
  'Slovaquie', 'Slovénie', 'Somalie', 'Soudan', 'Soudan du Sud', 'Sri Lanka', 'Suriname', 'Syrie',
  'Tadjikistan', 'Taïwan', 'Tanzanie', 'Timor oriental', 'Tonga', 'Trinité-et-Tobago', 'Turkménistan',
  'Tuvalu', 'Ukraine', 'Uruguay', 'Vanuatu', 'Vatican', 'Venezuela', 'Viêt Nam', 'Yémen', 'Zambie', 'Zimbabwe'
];

// Merge to create exhaustive countries list sorted alphabetically
export const ALL_COUNTRIES: CountryData[] = [
  ...WORLD_COUNTRIES,
  ...OTHER_COUNTRIES
    .filter(c => !WORLD_COUNTRIES.some(wc => wc.name.toLowerCase() === c.toLowerCase()))
    .map(name => ({
      name,
      code: name.slice(0, 2).toUpperCase(),
      prefix: '+00',
      flag: '🌐',
      cities: ['Capitale', 'Centre-ville', 'Zone métropolitaine']
    }))
].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
