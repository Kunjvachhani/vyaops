export type IndustryValue =
  | 'foundry_engineering'
  | 'food_beverage'
  | 'textile_apparel'
  | 'pharmaceutical_healthcare'
  | 'chemical_petrochemical'
  | 'automotive_components'
  | 'plastic_rubber'
  | 'paper_packaging_printing'
  | 'electronics_electrical'
  | 'metal_fabrication'
  | 'furniture_wood'
  | 'ceramic_tiles_glass'
  | 'leather_footwear'
  | 'gems_jewellery'
  | 'construction_materials'
  | 'agro_processing'
  | 'fmcg_consumer_goods'
  | 'medical_devices'

export type Industry = {
  value: IndustryValue
  label: string
  examples: string
}

export const INDUSTRIES: Industry[] = [
  {
    value: 'foundry_engineering',
    label: 'Foundry & Engineering',
    examples: 'Castings, Machined Parts, Precision Tools, Bearings, Gears, Dies & Moulds',
  },
  {
    value: 'food_beverage',
    label: 'Food & Beverage Processing',
    examples: 'Snacks, Dairy, Spices, Edible Oils, Beverages, Bakery, Packaged Foods',
  },
  {
    value: 'textile_apparel',
    label: 'Textile & Apparel',
    examples: 'Weaving, Spinning, Knitting, Dyeing, Garments, Technical Textiles',
  },
  {
    value: 'pharmaceutical_healthcare',
    label: 'Pharmaceutical & Healthcare',
    examples: 'Generic Medicines, APIs, Formulations, Nutraceuticals, Herbal Products',
  },
  {
    value: 'chemical_petrochemical',
    label: 'Chemical & Petrochemical',
    examples: 'Industrial Chemicals, Paints, Adhesives, Dyes, Agrochemicals, Soaps & Detergents',
  },
  {
    value: 'automotive_components',
    label: 'Automotive Components',
    examples: 'Body Parts, Interior Trim, Brake Systems, Wiring Harness, Forged Parts',
  },
  {
    value: 'plastic_rubber',
    label: 'Plastic & Rubber Products',
    examples: 'Injection Moulding, Extrusion, PVC Pipes, Industrial Rubber, Packaging Films',
  },
  {
    value: 'paper_packaging_printing',
    label: 'Paper, Packaging & Printing',
    examples: 'Corrugated Boxes, Flexible Packaging, Labels, Commercial Printing, Stationery',
  },
  {
    value: 'electronics_electrical',
    label: 'Electronics & Electrical Equipment',
    examples: 'PCBs, Cables & Wires, Switchgear, Motors, LED Lights, Control Panels',
  },
  {
    value: 'metal_fabrication',
    label: 'Metal Fabrication & Steel Products',
    examples: 'Structural Steel, Sheet Metal, Pipes & Fittings, Wire Drawing, Fasteners',
  },
  {
    value: 'furniture_wood',
    label: 'Furniture & Wood Products',
    examples: 'Wooden Furniture, Modular Furniture, Plywood, MDF, Interior Fixtures',
  },
  {
    value: 'ceramic_tiles_glass',
    label: 'Ceramic, Tiles & Glass',
    examples: 'Vitrified Tiles, Sanitary Ware, Refractory Bricks, Float Glass, Glassware',
  },
  {
    value: 'leather_footwear',
    label: 'Leather & Footwear',
    examples: 'Finished Leather, Shoes, Bags, Industrial Leather, Saddlery',
  },
  {
    value: 'gems_jewellery',
    label: 'Gems & Jewellery',
    examples: 'Diamond Cutting & Polishing, Gold Jewellery, Silver Articles, Imitation Jewellery',
  },
  {
    value: 'construction_materials',
    label: 'Construction Materials',
    examples: 'Bricks, Blocks, Cement Products, Aggregates, Prefab Structures, RCC Pipes',
  },
  {
    value: 'agro_processing',
    label: 'Agro-Processing & Milling',
    examples: 'Cotton Ginning, Rice Milling, Flour Mills, Sugar, Oil Extraction, Animal Feed',
  },
  {
    value: 'fmcg_consumer_goods',
    label: 'FMCG & Consumer Goods',
    examples: 'Household Products, Personal Care, Cosmetics, Candles, Incense, Stationery',
  },
  {
    value: 'medical_devices',
    label: 'Medical Devices & Equipment',
    examples: 'Surgical Instruments, Disposables, Diagnostic Equipment, Implants, Hospital Furniture',
  },
]
