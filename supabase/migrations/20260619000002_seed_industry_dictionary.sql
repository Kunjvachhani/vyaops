-- Seed: industry_dictionary with ~250 terms across 10 Gujarat MSME industries
-- All terms in Gujlish (Roman-script Gujarati) with Gujarati script variants where common
-- Source: seed, Confidence: 1.0

-- ============================================================
-- 1. FOUNDRY (casting, forging, machining)
-- ============================================================
INSERT INTO industry_dictionary (term, term_normalized, canonical, category, industry_segment, language) VALUES
('saancho', 'saancho', 'mould', 'tool', 'foundry', 'gujlish'),
('સાંચો', 'સાંચો', 'mould', 'tool', 'foundry', 'gujarati'),
('dhatu', 'dhatu', 'metal', 'material', 'foundry', 'gujlish'),
('ધાતુ', 'ધાતુ', 'metal', 'material', 'foundry', 'gujarati'),
('casting', 'casting', 'casting', 'process', 'foundry', 'gujlish'),
('bhatti', 'bhatti', 'furnace', 'tool', 'foundry', 'gujlish'),
('ભઠ્ઠી', 'ભઠ્ઠી', 'furnace', 'tool', 'foundry', 'gujarati'),
('lokhandi', 'lokhandi', 'iron', 'material', 'foundry', 'gujlish'),
('લોખંડી', 'લોખંડી', 'iron', 'material', 'foundry', 'gujarati'),
('pittal', 'pittal', 'brass', 'material', 'foundry', 'gujlish'),
('પિત્તળ', 'પિત્તળ', 'brass', 'material', 'foundry', 'gujarati'),
('tambanu', 'tambanu', 'copper', 'material', 'foundry', 'gujlish'),
('તાંબાનું', 'તાંબાનું', 'copper', 'material', 'foundry', 'gujarati'),
('kaathli', 'kaathli', 'lathe', 'tool', 'foundry', 'gujlish'),
('chamkavo', 'chamkavo', 'polish', 'process', 'foundry', 'gujlish'),
('ghadhvo', 'ghadhvo', 'forge', 'process', 'foundry', 'gujlish'),
('ઘડવો', 'ઘડવો', 'forge', 'process', 'foundry', 'gujarati'),
('pattern', 'pattern', 'pattern', 'tool', 'foundry', 'gujlish'),
('chhippu', 'chhippu', 'flash', 'defect', 'foundry', 'gujlish'),
('pighlaavu', 'pighlaavu', 'melt', 'process', 'foundry', 'gujlish'),
('taliya', 'taliya', 'sprue', 'product', 'foundry', 'gujlish'),
('riser', 'riser', 'riser', 'product', 'foundry', 'gujlish'),
('blow hole', 'blow hole', 'blow_hole', 'defect', 'foundry', 'gujlish'),
('shrinkage', 'shrinkage', 'shrinkage', 'defect', 'foundry', 'gujlish'),
('si casting', 'si casting', 'ci_casting', 'product', 'foundry', 'gujlish'),
('sg iron', 'sg iron', 'sg_iron', 'material', 'foundry', 'gujlish'),
('machining', 'machining', 'machining', 'process', 'foundry', 'gujlish'),
('fettling', 'fettling', 'fettling', 'process', 'foundry', 'gujlish');

-- ============================================================
-- 2. TEXTILES (weaving, dyeing, garments)
-- ============================================================
INSERT INTO industry_dictionary (term, term_normalized, canonical, category, industry_segment, language) VALUES
('thaan', 'thaan', 'bolt_of_fabric', 'unit', 'textiles', 'gujlish'),
('થાન', 'થાન', 'bolt_of_fabric', 'unit', 'textiles', 'gujarati'),
('kapadh', 'kapadh', 'cloth', 'product', 'textiles', 'gujlish'),
('કાપડ', 'કાપડ', 'cloth', 'product', 'textiles', 'gujarati'),
('dhago', 'dhago', 'yarn', 'material', 'textiles', 'gujlish'),
('ધાગો', 'ધાગો', 'yarn', 'material', 'textiles', 'gujarati'),
('rangaai', 'rangaai', 'dyeing', 'process', 'textiles', 'gujlish'),
('રંગાઈ', 'રંગાઈ', 'dyeing', 'process', 'textiles', 'gujarati'),
('vanavat', 'vanavat', 'weaving', 'process', 'textiles', 'gujlish'),
('chhapkaam', 'chhapkaam', 'printing', 'process', 'textiles', 'gujlish'),
('છાપકામ', 'છાપકામ', 'printing', 'process', 'textiles', 'gujarati'),
('suti', 'suti', 'cotton', 'material', 'textiles', 'gujlish'),
('સુતી', 'સુતી', 'cotton', 'material', 'textiles', 'gujarati'),
('reshmi', 'reshmi', 'silk', 'material', 'textiles', 'gujlish'),
('bunvu', 'bunvu', 'weave', 'process', 'textiles', 'gujlish'),
('katraan', 'katraan', 'cutting_waste', 'defect', 'textiles', 'gujlish'),
('khadi', 'khadi', 'handloom', 'product', 'textiles', 'gujlish'),
('synthetic', 'synthetic', 'synthetic', 'material', 'textiles', 'gujlish'),
('loom', 'loom', 'loom', 'tool', 'textiles', 'gujlish'),
('tana', 'tana', 'warp', 'material', 'textiles', 'gujlish'),
('bana', 'bana', 'weft', 'material', 'textiles', 'gujlish'),
('sizing', 'sizing', 'sizing', 'process', 'textiles', 'gujlish'),
('dobby', 'dobby', 'dobby', 'tool', 'textiles', 'gujlish'),
('jacquard', 'jacquard', 'jacquard', 'tool', 'textiles', 'gujlish'),
('grey fabric', 'grey fabric', 'grey_fabric', 'product', 'textiles', 'gujlish');

-- ============================================================
-- 3. CERAMICS (tiles, sanitaryware)
-- ============================================================
INSERT INTO industry_dictionary (term, term_normalized, canonical, category, industry_segment, language) VALUES
('rangoli', 'rangoli', 'glaze', 'material', 'ceramics', 'gujlish'),
('bhatti', 'bhatti', 'kiln', 'tool', 'ceramics', 'gujlish'),
('maati', 'maati', 'clay', 'material', 'ceramics', 'gujlish'),
('માટી', 'માટી', 'clay', 'material', 'ceramics', 'gujarati'),
('tile', 'tile', 'tile', 'product', 'ceramics', 'gujlish'),
('firing', 'firing', 'firing', 'process', 'ceramics', 'gujlish'),
('vitrified', 'vitrified', 'vitrified', 'product', 'ceramics', 'gujlish'),
('slip', 'slip', 'slip', 'material', 'ceramics', 'gujlish'),
('biscuit', 'biscuit', 'bisque', 'process', 'ceramics', 'gujlish'),
('polski', 'polski', 'polish', 'process', 'ceramics', 'gujlish'),
('sanitaryware', 'sanitaryware', 'sanitaryware', 'product', 'ceramics', 'gujlish'),
('tableware', 'tableware', 'tableware', 'product', 'ceramics', 'gujlish'),
('press', 'press', 'press', 'tool', 'ceramics', 'gujlish'),
('frit', 'frit', 'frit', 'material', 'ceramics', 'gujlish'),
('engobe', 'engobe', 'engobe', 'material', 'ceramics', 'gujlish'),
('body', 'body', 'ceramic_body', 'material', 'ceramics', 'gujlish'),
('porcelain', 'porcelain', 'porcelain', 'material', 'ceramics', 'gujlish'),
('chipping', 'chipping', 'chipping', 'defect', 'ceramics', 'gujlish'),
('crazing', 'crazing', 'crazing', 'defect', 'ceramics', 'gujlish'),
('warping', 'warping', 'warping', 'defect', 'ceramics', 'gujlish');

-- ============================================================
-- 4. CHEMICALS (industrial chemicals, dyes, pigments)
-- ============================================================
INSERT INTO industry_dictionary (term, term_normalized, canonical, category, industry_segment, language) VALUES
('dravya', 'dravya', 'chemical', 'product', 'chemicals', 'gujlish'),
('દ્રવ્ય', 'દ્રવ્ય', 'chemical', 'product', 'chemicals', 'gujarati'),
('acid', 'acid', 'acid', 'product', 'chemicals', 'gujlish'),
('alkali', 'alkali', 'alkali', 'product', 'chemicals', 'gujlish'),
('solvent', 'solvent', 'solvent', 'product', 'chemicals', 'gujlish'),
('catalyst', 'catalyst', 'catalyst', 'material', 'chemicals', 'gujlish'),
('compound', 'compound', 'compound', 'product', 'chemicals', 'gujlish'),
('reactor', 'reactor', 'reactor', 'tool', 'chemicals', 'gujlish'),
('distillation', 'distillation', 'distillation', 'process', 'chemicals', 'gujlish'),
('pigment', 'pigment', 'pigment', 'product', 'chemicals', 'gujlish'),
('resin', 'resin', 'resin', 'material', 'chemicals', 'gujlish'),
('dye', 'dye', 'dye', 'product', 'chemicals', 'gujlish'),
('rang', 'rang', 'dye', 'product', 'chemicals', 'gujlish'),
('રંગ', 'રંગ', 'dye', 'product', 'chemicals', 'gujarati'),
('formulation', 'formulation', 'formulation', 'process', 'chemicals', 'gujlish'),
('titration', 'titration', 'titration', 'process', 'chemicals', 'gujlish'),
('concentrate', 'concentrate', 'concentrate', 'product', 'chemicals', 'gujlish'),
('dilute', 'dilute', 'dilute', 'process', 'chemicals', 'gujlish'),
('emulsion', 'emulsion', 'emulsion', 'product', 'chemicals', 'gujlish'),
('purity', 'purity', 'purity', 'measurement', 'chemicals', 'gujlish');

-- ============================================================
-- 5. PHARMA (tablets, capsules, formulations)
-- ============================================================
INSERT INTO industry_dictionary (term, term_normalized, canonical, category, industry_segment, language) VALUES
('goli', 'goli', 'tablet', 'product', 'pharma', 'gujlish'),
('ગોળી', 'ગોળી', 'tablet', 'product', 'pharma', 'gujarati'),
('capsule', 'capsule', 'capsule', 'product', 'pharma', 'gujlish'),
('dawai', 'dawai', 'medicine', 'product', 'pharma', 'gujlish'),
('દવાઈ', 'દવાઈ', 'medicine', 'product', 'pharma', 'gujarati'),
('syrup', 'syrup', 'syrup', 'product', 'pharma', 'gujlish'),
('injection', 'injection', 'injection', 'product', 'pharma', 'gujlish'),
('strip', 'strip', 'strip', 'unit', 'pharma', 'gujlish'),
('formulation', 'formulation', 'formulation', 'process', 'pharma', 'gujlish'),
('api', 'api', 'api_ingredient', 'material', 'pharma', 'gujlish'),
('excipient', 'excipient', 'excipient', 'material', 'pharma', 'gujlish'),
('blister', 'blister', 'blister_pack', 'unit', 'pharma', 'gujlish'),
('ointment', 'ointment', 'ointment', 'product', 'pharma', 'gujlish'),
('suspension', 'suspension', 'suspension', 'product', 'pharma', 'gujlish'),
('granules', 'granules', 'granules', 'product', 'pharma', 'gujlish'),
('coating', 'coating', 'coating', 'process', 'pharma', 'gujlish'),
('compression', 'compression', 'compression', 'process', 'pharma', 'gujlish'),
('stability', 'stability', 'stability_testing', 'process', 'pharma', 'gujlish'),
('dissolution', 'dissolution', 'dissolution_test', 'process', 'pharma', 'gujlish'),
('potency', 'potency', 'potency', 'measurement', 'pharma', 'gujlish');

-- ============================================================
-- 6. AUTO PARTS (manufacturing, machining)
-- ============================================================
INSERT INTO industry_dictionary (term, term_normalized, canonical, category, industry_segment, language) VALUES
('patti', 'patti', 'sheet_metal', 'material', 'auto_parts', 'gujlish'),
('પટ્ટી', 'પટ્ટી', 'sheet_metal', 'material', 'auto_parts', 'gujarati'),
('nut bolt', 'nut bolt', 'nut_bolt', 'product', 'auto_parts', 'gujlish'),
('washer', 'washer', 'washer', 'product', 'auto_parts', 'gujlish'),
('bearing', 'bearing', 'bearing', 'product', 'auto_parts', 'gujlish'),
('brake pad', 'brake pad', 'brake_pad', 'product', 'auto_parts', 'gujlish'),
('silencer', 'silencer', 'silencer', 'product', 'auto_parts', 'gujlish'),
('radiator', 'radiator', 'radiator', 'product', 'auto_parts', 'gujlish'),
('clutch plate', 'clutch plate', 'clutch_plate', 'product', 'auto_parts', 'gujlish'),
('gasket', 'gasket', 'gasket', 'product', 'auto_parts', 'gujlish'),
('bushing', 'bushing', 'bushing', 'product', 'auto_parts', 'gujlish'),
('spring', 'spring', 'spring', 'product', 'auto_parts', 'gujlish'),
('forging', 'forging', 'forging', 'process', 'auto_parts', 'gujlish'),
('stamping', 'stamping', 'stamping', 'process', 'auto_parts', 'gujlish'),
('cnc', 'cnc', 'cnc_machining', 'process', 'auto_parts', 'gujlish'),
('heat treatment', 'heat treatment', 'heat_treatment', 'process', 'auto_parts', 'gujlish'),
('plating', 'plating', 'plating', 'process', 'auto_parts', 'gujlish'),
('shaft', 'shaft', 'shaft', 'product', 'auto_parts', 'gujlish'),
('pin', 'pin', 'pin', 'product', 'auto_parts', 'gujlish'),
('die casting', 'die casting', 'die_casting', 'process', 'auto_parts', 'gujlish');

-- ============================================================
-- 7. PLASTICS (moulding, extrusion)
-- ============================================================
INSERT INTO industry_dictionary (term, term_normalized, canonical, category, industry_segment, language) VALUES
('danu', 'danu', 'granules', 'material', 'plastics', 'gujlish'),
('દાણું', 'દાણું', 'granules', 'material', 'plastics', 'gujarati'),
('mould', 'mould', 'mould', 'tool', 'plastics', 'gujlish'),
('injection moulding', 'injection moulding', 'injection_moulding', 'process', 'plastics', 'gujlish'),
('extrusion', 'extrusion', 'extrusion', 'process', 'plastics', 'gujlish'),
('blow moulding', 'blow moulding', 'blow_moulding', 'process', 'plastics', 'gujlish'),
('pet', 'pet', 'pet_plastic', 'material', 'plastics', 'gujlish'),
('hdpe', 'hdpe', 'hdpe', 'material', 'plastics', 'gujlish'),
('pp', 'pp', 'polypropylene', 'material', 'plastics', 'gujlish'),
('scrap', 'scrap', 'regrind', 'material', 'plastics', 'gujlish'),
('preform', 'preform', 'preform', 'product', 'plastics', 'gujlish'),
('pvc', 'pvc', 'pvc', 'material', 'plastics', 'gujlish'),
('abs', 'abs', 'abs', 'material', 'plastics', 'gujlish'),
('nylon', 'nylon', 'nylon', 'material', 'plastics', 'gujlish'),
('masterbatch', 'masterbatch', 'masterbatch', 'material', 'plastics', 'gujlish'),
('shrinkage', 'shrinkage', 'shrinkage', 'defect', 'plastics', 'gujlish'),
('flash', 'flash', 'flash', 'defect', 'plastics', 'gujlish'),
('sink mark', 'sink mark', 'sink_mark', 'defect', 'plastics', 'gujlish'),
('warpage', 'warpage', 'warpage', 'defect', 'plastics', 'gujlish'),
('cycle time', 'cycle time', 'cycle_time', 'measurement', 'plastics', 'gujlish');

-- ============================================================
-- 8. DIAMOND (cutting, polishing)
-- ============================================================
INSERT INTO industry_dictionary (term, term_normalized, canonical, category, industry_segment, language) VALUES
('heero', 'heero', 'diamond', 'product', 'diamond', 'gujlish'),
('હીરો', 'હીરો', 'diamond', 'product', 'diamond', 'gujarati'),
('polishing', 'polishing', 'polishing', 'process', 'diamond', 'gujlish'),
('ghaat', 'ghaat', 'faceting', 'process', 'diamond', 'gujlish'),
('ઘાટ', 'ઘાટ', 'faceting', 'process', 'diamond', 'gujarati'),
('kaankaro', 'kaankaro', 'rough_stone', 'material', 'diamond', 'gujlish'),
('કાંકરો', 'કાંકરો', 'rough_stone', 'material', 'diamond', 'gujarati'),
('four p', 'four p', '4p_cut', 'product', 'diamond', 'gujlish'),
('marking', 'marking', 'marking', 'process', 'diamond', 'gujlish'),
('sawing', 'sawing', 'sawing', 'process', 'diamond', 'gujlish'),
('laser cutting', 'laser cutting', 'laser_cutting', 'process', 'diamond', 'gujlish'),
('sieve', 'sieve', 'sieve_size', 'measurement', 'diamond', 'gujlish'),
('ચાળણી', 'ચાળણી', 'sieve_size', 'measurement', 'diamond', 'gujarati'),
('inclusion', 'inclusion', 'inclusion', 'defect', 'diamond', 'gujlish'),
('clarity', 'clarity', 'clarity', 'measurement', 'diamond', 'gujlish'),
('colour', 'colour', 'colour_grade', 'measurement', 'diamond', 'gujlish'),
('brilliant cut', 'brilliant cut', 'brilliant_cut', 'product', 'diamond', 'gujlish'),
('round', 'round', 'round_cut', 'product', 'diamond', 'gujlish'),
('fancy', 'fancy', 'fancy_shape', 'product', 'diamond', 'gujlish'),
('certified', 'certified', 'certified', 'measurement', 'diamond', 'gujlish'),
('gia', 'gia', 'gia_certified', 'measurement', 'diamond', 'gujlish'),
('melee', 'melee', 'melee', 'product', 'diamond', 'gujlish');

-- ============================================================
-- 9. FOOD PROCESSING (spices, grains, oils)
-- ============================================================
INSERT INTO industry_dictionary (term, term_normalized, canonical, category, industry_segment, language) VALUES
('masalo', 'masalo', 'spice', 'product', 'food_processing', 'gujlish'),
('મસાલો', 'મસાલો', 'spice', 'product', 'food_processing', 'gujarati'),
('daal', 'daal', 'lentil', 'product', 'food_processing', 'gujlish'),
('દાળ', 'દાળ', 'lentil', 'product', 'food_processing', 'gujarati'),
('tel', 'tel', 'oil', 'product', 'food_processing', 'gujlish'),
('તેલ', 'તેલ', 'oil', 'product', 'food_processing', 'gujarati'),
('ghee', 'ghee', 'ghee', 'product', 'food_processing', 'gujlish'),
('ઘી', 'ઘી', 'ghee', 'product', 'food_processing', 'gujarati'),
('atta', 'atta', 'flour', 'product', 'food_processing', 'gujlish'),
('લોટ', 'લોટ', 'flour', 'product', 'food_processing', 'gujarati'),
('packaging', 'packaging', 'packaging', 'process', 'food_processing', 'gujlish'),
('grading', 'grading', 'grading', 'process', 'food_processing', 'gujlish'),
('cleaning', 'cleaning', 'cleaning', 'process', 'food_processing', 'gujlish'),
('roasting', 'roasting', 'roasting', 'process', 'food_processing', 'gujlish'),
('grinding', 'grinding', 'grinding', 'process', 'food_processing', 'gujlish'),
('sortex', 'sortex', 'sorting_machine', 'tool', 'food_processing', 'gujlish'),
('fssai', 'fssai', 'fssai_licence', 'measurement', 'food_processing', 'gujlish'),
('shelf life', 'shelf life', 'shelf_life', 'measurement', 'food_processing', 'gujlish'),
('moisture', 'moisture', 'moisture_content', 'measurement', 'food_processing', 'gujlish'),
('adulteration', 'adulteration', 'adulteration', 'defect', 'food_processing', 'gujlish');

-- ============================================================
-- 10. AGRI (farming, seeds, fertilizers)
-- ============================================================
INSERT INTO industry_dictionary (term, term_normalized, canonical, category, industry_segment, language) VALUES
('khaatar', 'khaatar', 'fertilizer', 'product', 'agri', 'gujlish'),
('ખાતર', 'ખાતર', 'fertilizer', 'product', 'agri', 'gujarati'),
('beej', 'beej', 'seed', 'product', 'agri', 'gujlish'),
('બીજ', 'બીજ', 'seed', 'product', 'agri', 'gujarati'),
('dawai', 'dawai', 'pesticide', 'product', 'agri', 'gujlish'),
('paak', 'paak', 'crop', 'product', 'agri', 'gujlish'),
('પાક', 'પાક', 'crop', 'product', 'agri', 'gujarati'),
('sinchai', 'sinchai', 'irrigation', 'process', 'agri', 'gujlish'),
('સિંચાઈ', 'સિંચાઈ', 'irrigation', 'process', 'agri', 'gujarati'),
('tractor', 'tractor', 'tractor', 'tool', 'agri', 'gujlish'),
('harvest', 'harvest', 'harvest', 'process', 'agri', 'gujlish'),
('spray', 'spray', 'spraying', 'process', 'agri', 'gujlish'),
('छंटकाव', 'छंटकाव', 'spraying', 'process', 'agri', 'hindi'),
('organic', 'organic', 'organic', 'product', 'agri', 'gujlish'),
('urea', 'urea', 'urea', 'product', 'agri', 'gujlish'),
('dap', 'dap', 'dap_fertilizer', 'product', 'agri', 'gujlish'),
('drip', 'drip', 'drip_irrigation', 'tool', 'agri', 'gujlish'),
('greenhouse', 'greenhouse', 'greenhouse', 'tool', 'agri', 'gujlish'),
('mandi', 'mandi', 'market', 'process', 'agri', 'gujlish'),
('મંડી', 'મંડી', 'market', 'process', 'agri', 'gujarati'),
('yield', 'yield', 'yield', 'measurement', 'agri', 'gujlish'),
('bigha', 'bigha', 'bigha_land_unit', 'unit', 'agri', 'gujlish'),
('વીઘા', 'વીઘા', 'bigha_land_unit', 'unit', 'agri', 'gujarati'),
('vigha', 'vigha', 'bigha_land_unit', 'unit', 'agri', 'gujlish');
