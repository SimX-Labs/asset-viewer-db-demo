# Suggested authored tags

Vocabulary only. Grounded in the 2026-08-19 scrape (`unity-asset-documentation/db`) and Unity folder names. Do not duplicate scraped tags already on rows: **Grabbable**, **Prop**, **Generator**, **Core**.

## Global

- **Military** — Combat / TCCC / field-clinic assets across tools, clothing, environments, and audio (e.g. `kit_MilitaryBagAdvanced_CASEVAC`, `env_destroyed_city_military1`, `CASEVAC_RifleFire`).
- **Pediatric** — Child-oriented tools, equipment, environments, and videos that are not limited to character age (e.g. `group_broselow_cart`, `env_ed_room_childrens_national`, Mercy Kansas pediatric US loops).
- **Neonatal** — Newborn-specific models and attachables that also appear as tools (e.g. `character_core_newborn01_base`, `equipment_baby_iv_hand_left`, `equipment_baby_hat`).
- **Obstetric** — Labor, pregnancy, and GYN assets that span tools, equipment, characters, and ultrasound (e.g. `kit_labor_delivery`, `character_core_adult04_pregnant_base`, `Transvaginal Early IUP`).
- **Prehospital** — EMS / ambulance / scene-care assets across tools, environments, and radio SFX (e.g. `kit_ems_medic_bag-Trauma`, `env_ambulance`, `EMS_RadioChatter`).
- **Trauma** — Injury-management slice that is not just one type (e.g. `kit_specialty_bag_trauma_burn`, `character_core_adult04_p05_Facial_Trauma`, `env_core_trauma_center`).
- **Surgical** — OR / sterile / operative assets across tools, clothing, and rooms (e.g. `kit_abdominal_laparotomy`, `Kit_Surgical_Gown_Pack`, `OR Room 1`).
- **Critical Care** — ICU / vent / high-acuity monitoring across tools and rooms (e.g. `tool_hamiltonT1_ventilator`, `env_core_icu`, `tool_crrt_dialysis_machine`).
- **Home Care** — Community and residence settings plus the bags used there (e.g. `env_apartment_2_bedroom_victoria_gonzales_at_home`, `tool_home_care_bag_empty`, `kit_nursing_bag`).
- **Canine** — MWD / veterinary slice across videos and field environments (e.g. `MWD Cardiac Normal Para Sternal Long Axis Default`, `env_arab_city_mwd_acute_head_trauma`). Existing video label `us_canine` is the machine name; this is the human filter.

## Tooling

- **Airway** — Intubation, cric, trach, and airway carts (e.g. `kit_intubation`, `kit_criq`, `group_airway_cart`).
- **Oxygen** — Cannulas, NRB/venturi, tanks, flowmeters (e.g. `tool_nasalcannula_etco2`, Oxygen Tank / VenturiMask folders).
- **Ventilator** — Portable and branded vents (e.g. `tool_portable_ventilator`, `tool_hamiltonT1_ventilator_perf_testing`).
- **Vascular Access** — PIV, IO, PICC, central line, REBOA (e.g. `kit_ez_io`, `kit_picc`, `kit_reboa_catheter`).
- **Infusion** — Pumps, warmers, transfusion, rapid infusers (e.g. `kit_blood_transfusion_tubing`, IV Pump Volumetric folders).
- **Hemorrhage Control** — Tourniquets, combat gauze, packing (e.g. `tool_chito_gauze_stack`, `tool_gauze_rolled`).
- **Wound Care** — Dressings, pads, culture, debridement (e.g. `kit_wound_dressing`, `kit_central_line_dressing_change`).
- **Cardiac** — AED/defib, pacing, pericardiocentesis (e.g. `tool_aed`, `kit_pericardiocentesis_kit`).
- **Monitoring** — Vitals baskets, glucometer, capnography, stethoscope (e.g. `group_vitals_basket`, `tool_thermometer_head`).
- **Respiratory** — Suction, chest tubes, nebulizers, drains (e.g. `kit_chest_tube`, `group_suction_basket`).
- **Imaging** — Ultrasound machines and Doppler (e.g. `group_UltrasoundMachine_2024`, `tool_doppler`).
- **Labs** — POC and specimen kits (e.g. IStat, `kit_STI_testing`, Guaiac / Urinalysis folders).
- **GI / GU** — Foley, NG, colostomy, emesis (e.g. `kit_foley_catheter_current`, `kit_ng_tube`).
- **Neuro** — NIHSS, EVD, seizure call (e.g. `tool_evd_monitoring_system`, NIHSScards folder).
- **PPE** — Gowns, gloves, isolation carts (e.g. `Kit_SterileLatexGloves`, `group_ppe_cart`).
- **Med Admin** — Syringes, vials, labeled bottles, med boxes as tools (e.g. `kit_ems_medication_box`, Medications folder). Distinct from the Medications catalog.

## Vessels

- **Cart** — Empty/custom rolling carts (e.g. `group_cart_customizable`, `group_code_cart_empty`, `custom_vessel/129456-Nursing Cart Peds Blunt Trauma`).
- **Bag** — Packs and duffels used as vessels (e.g. `tool_military_backpack_EMPTY`, `tool_march_bag_empty`, `kit_EMS_BroselowBag_Empty`).
- **Kit** — Small empty trays/kits (e.g. `vessel_small_kit_empty`, `custom_vessel/cldcKit`).
- **Room Item** — Furniture-shaped vessels (e.g. `vessel_wardrobe_empty`, `vessel_tool_meal_tray`, `vessel_kit_bed_bath_basin`).

## Audio

- **Combat** — Gunfire, explosions, CASEVAC fight beds (e.g. `ak47_shooting`, `Grenade_exploding`, `CASEVAC_MGFire`).
- **Ambient** — Location beds (e.g. `Ambient_Suburban`, `C130_Background_Audio`, `CASEVAC_MilitaryAmbient`).
- **Radio** — Chatter loops (e.g. `EMS_RadioChatter`, `CASEVAC_RadioChatter_v2`).
- **Equipment Loop** — Machine state audio (e.g. `AnesthesiaMachine_State0EntryAndLoop`).

Music vs sound-effect is already a sidebar split; only one music clip exists (`relaxing-bg-music`).

## Videos

Do not re-add `ultrasound` or the existing `us_abnormal` label (it is on all 78 rows). Prefer these human view tags; **Canine** is a cleaner label for stored `us_canine`.

- **Cardiac** — Heart views and pathology (e.g. `A4C Cardiac`, `Cardiac Tamponade`, `Subxiphoid Cardiac Normal`).
- **FAST** — RUQ / LUQ / pelvic free-fluid loops (e.g. `RUQ Positive`, `LUQFreeFluid`, `Pelvic Free Fluid`).
- **Lung** — Sliding, A/B lines, pneumothorax (e.g. `A Lines No Sliding`, `Pneumothorax Lung`).
- **Vascular Access** — Vein/artery/wire confirmation (e.g. `R Upper Arm Vein Access`, `Rij Needle`, `Subxiphoid Wire Confirmed`).
- **Obstetric** — TA/TV pregnancy loops (e.g. `Transvaginal Early IUP`, `Transabdominal 3rd Trimester Pregnancy`).
- **Ocular** — Eye / nerve-sheath loops (e.g. `Ocular Papilledema`, `Ocular Enlarged Nerve Sheath`).
- **Renal** — Kidney loops (e.g. `KidneyLeft Hydronephrosis`, `KidneyRight Normal`).
- **Canine** — Human label for `us_canine` (e.g. `MWD RUQ Diaph Hepatic Default`).

## Characters

Age from the key is the useful facet; skip a “Core Variant” tag.

- **Newborn** — `character_core_newborn01_*` (6).
- **Toddler** — `character_core_toddler01_*` (5).
- **Child** — `character_core_child0*` (10).
- **Adolescent** — `character_core_adolescent0*` (27).
- **Adult** — `character_core_adult*` (61).
- **Elder** — `character_core_elder0*` (18).
- **Pregnant** — Pregnancy meshes (e.g. `character_core_adult04_pregnant_base`, `character_core_elder02_pregnant_base`).
- **Injury Presentation** — Anatomy/injury variants that authors hunt for (e.g. `character_core_adult04_p05_Facial_Trauma`, `character_core_adult04_p05_DoubleLegAmputation`, `character_core_adult03_p12_PCC_TBI`).

## Equipment

- **Vascular Access** — Worn IVs, PICC, saline locks (e.g. `equipment_baby_iv_hand_left`, IV Equipment folder).
- **IO** — Intraosseous sites/needles (e.g. IO Equipment, `equipment_*ezio*` / `equipment_io_*`).
- **Monitoring** — BP cuffs, pulse ox, cardiac leads (e.g. `equipment_bpcuff_L`, Pulse Ox / CARDIACLEADS).
- **Defibrillation** — Pads and Zoll attachables (e.g. `equipment_aed_pad_left`, Defib folder).
- **Oxygen** — Cannulas and O2 tubing on the body (e.g. Nasal Cannula Attachable Tubing, Oxygen folder).
- **Hemorrhage Control** — Tourniquets, wraps, chito gauze on limbs (e.g. Tourniquet folder, `equipment_chito_gauze_right_calf`).
- **Wound** — Dressings, incisions, blood spurts, debridement (e.g. `ChestIncisionLeft-Zero`, `Debridement Leg Left`).
- **Immobilization** — Collars, boards, slings, binders (e.g. `equipment_arm_splints_slings`, `equipment_back_board`).
- **Chest Procedure** — Chest tube, needle decompression (e.g. Chest Tube folder, Needle Decompression folder).
- **Hair** — Hair prefabs (~56 rows; e.g. `equipment_hair_bun_adult04`, `hair_chic_bun_med_brown_adult04`).
- **Identification** — Wristbands and ID (e.g. `equipment_identification_*`).
- **Comfort** — Blankets, pillows, baby hat/swaddle (e.g. `equipment_blanket_adult_core`, `equipment_baby_blanket`).
- **Assessment** — Palpation, dermatomes, myotomes, cap refill (e.g. Palpation, Dermatomes, CapillaryRefill folders).
- **Insulin Pump** — Worn pumps (e.g. `equipment_InsulinPump_*`, 14 rows).
- **Restraints** — Soft restraints (e.g. `equipment_RestraintsSoft_*`).

## Clothing

- **Civilian** — Street clothes (e.g. `Hoodie`, `Jeans`, `T Shirt`).
- **Patient** — Gowns, diapers, nonskid/slippers (e.g. `Gown`, `Nightgown`, `Slippers White`).
- **Scrubs** — Staff scrub tops/pants (e.g. `Scrub Shirt`, `Scrub Pants`).
- **Uniform** — Police / EMT / lab (e.g. `Emt Shirt Short Cyan`, `Police Shirt Short Cyan`, `Labcoat Long`).
- **PPE** — Gloves, masks, isolation tops (e.g. `character_adult01_SterileGloves`, `Ppetop Yellow`).
- **Footwear** — Shoes/boots as a slot (e.g. `Sneakers`, `Boots Usaf`, `Emt Shoes`).
- **Undergarment** — Bras, boxers, briefs (e.g. `Sportsbra Blue`, `Underwear Bottoms`).
- **Soiled** — Bloody / muddy / dirty variants authors reuse for trauma (e.g. `Field Jacket Usaf Dirty Bloody`, `T Shirt Bloodysooty`).

Military fatigues can take the Global **Military** tag plus **Uniform** if you want both filters.

## Medications

Skip container (`IVBag`, `Vial`, …) — already in `medContainer` / AssetType. These are clinical-use buckets over ~631 rows:

- **ACLS** — Crash-cart resus meds (e.g. `Epinephrine`, `Amiodarone`, `AtropineSulfate`).
- **Analgesic** — Pain meds (e.g. `Acetaminophen`, `Fentanyl`, `HYDROmorphoneHCL`).
- **Sedation** — Benzos / induction (e.g. `Midazolam`, `Lorazepam`, `Propofol`).
- **Vasopressor** — Pressors (e.g. `Norepinephrine`, `Phenylephrine`, `Vasopressin`).
- **Antibiotic** — Abx (e.g. `CefTRIAXone`, `Vancomycin`, `Levofloxacin`).
- **IV Fluid** — Crystalloids / dextrose bags (e.g. `0.9% Sodium Chloride`, `Lactated` Ringer’s, `10% Dextrose`).
- **Electrolyte** — Repletion (e.g. `Potassium`, `SodiumBicarbonate`, `Magnesium`).
- **Insulin** — Insulin / glucagon products (e.g. `Insulin`).
- **Antidote** — Overdose / toxicology (e.g. `Acetylcysteine`, `ActivatedCharcoal`).
- **Anticoagulant** — (e.g. `Heparin`).
- **Antiemetic** — (e.g. `Ondansetron`).
- **Psychiatric** — Psychotropics (e.g. `ParoxetineHCl_10mg`).
- **Respiratory** — Inhaled / neb meds (nebulizer + inhaler containers, plus airway adjuncts like `DantroleneSodium`).

## Waveforms

- **Arrhythmia** — Named path rhythms (e.g. `Afib`, `Vfib`, `Vtach`, `SVT Max HR 250`, `Bradycardia`, `PVCs`).
- **Default Trace** — Stock monitor channels (e.g. `Default ECG`, `Default PLETH`, `Default RESP`, `Default VENT1`).
- **Artifact** — CPR noise traces (e.g. `CPR Artifact`, `CPR Artifact Max HR 150`).
- **Capnography** — (e.g. `EtCO2`, `EtCO2 Max RR 72`).
- **Anesthesia** — Machine traces (e.g. `Flowrate - Anesthesia Machine`, `Pressure - Anesthesia Machine`).

## Scenarios

59 imported cases. Names already carry product codes; tags should be workflow, not the title.

- **Demo** — Showcase / demo cases (e.g. `[[Authoring - Showcase 2]]`, `[DEMO] Med Administration and Post-Op Care`).
- **WIP** — In-progress imports (e.g. `[WIP] New-Onset Type 2 Diabetes Moderator-Optional`).
- **Nursing** — Prelicensure / NE cases (e.g. `NE: Airway Management and Oxygen Therapy`, `NE: Colostomy and Palliative Care Management`).
- **OSCE** — Exam cases (e.g. `[CIV-311] OSCE 3 - Delivering Bad News`).
- **Skills** — Single-skill trainers (e.g. vascular-access pair, `Asparaginase Infusion Management`).

## Scenes

None suggested — no `kind: scene` rows in the current scrape.

## Environments

- **ED** — Emergency rooms (~45; e.g. `env_ed_room_chest_pain_acs`, `env_ed_room_childrens_national`).
- **Inpatient** — Ward rooms (largest slice; e.g. `env_core_inpatient4_with_hallway`, `env_inpatient4_*`).
- **ICU** — (e.g. `env_core_icu`, `env_icu_room_extended_PICU`).
- **Exam Room** — Clinic / OSCE rooms (e.g. `env_core_exam_room`, `env_allied_health_free_clinic_exam_room`).
- **Field** — Outdoor / destroyed / desert / tent military beds not covered by Global Military alone if you want setting not affiliation (e.g. `env_desert_village_entrapment`, `env_forward_*`). Optional if Military is enough.
- **Aviation** — Helo / AE-CCAT / Air Methods (e.g. `env_ae_ccat`, `env_CV22_helicopter`, `env_ed_room_air_methods`).
- **Psychiatric** — (e.g. Psych Ward / `env_psych*`).
- **Night** — Lighting variants (e.g. `env_destroyed_city_military1_night`, `env_arab_city_night`).
- **Outdoor** — Roads, beach, pool, street (e.g. `env_Beach`, `env_highway*`, `env_distracted_driver`).
- **Ambulance** — (e.g. `env_ambulance`, `env_ambulance_inferior_stemi`).

Home / military / pediatric rooms should use the Global tags rather than a second copy here. **Field** is the only extra I would keep if authors need “outside the hospital” without implying military.

## Authored Environments

Sparse (18), mostly nursing copies on a Model scene.

- **Nursing** — Essentials / prelicensure layouts (e.g. `Essentials - Airway-833412`, `postpartumHemhorrage (Copy)-316494`).
- **Skills Trainer** — Focused skill rooms (e.g. `402372-ARDS Skills Trainer Case`).
- **Test** — Authoring sandboxes (e.g. `275136-Waiting Room`, description “Test Environment”).

## Interactions

Location is already the row identity (935 unique locations / 939 rows), so do not tag the raw location string. Body-region buckets are the only filter that still helps:

- **Head / Face** — (e.g. locations matching eye/ear/mouth).
- **Airway** — (e.g. `oralAirway`, trach/cric-style locations).
- **Chest** — (e.g. `LungBackLT`, `aedLeft`).
- **Abdomen / Pelvis** — (e.g. `Abdomen`, `Vulva`).
- **Upper Extremity** — (e.g. `IVForearmLeft`, `Wrist_R`).
- **Lower Extremity** — (e.g. `FemoralR`, `FootTopL`).
- **Wound** — (e.g. `packableWound`, `stapleWound`).
- **Line / Device** — Tool-to-tool anchors (e.g. `mount_iv_pump_volumetric_vertical_stack`, `ivBagTransfusionSpike`).

## Character Metadata

Do not tag the `key` name. Domain groups over the 43 keys:

- **Eyes** — Gaze/pupils (e.g. `pupilSizeLeft`, `abnormalEyeFollow`, `cantLookDown`).
- **Clothing** — (`clothing`, `loadClothing`, `changeClothingTexture`).
- **Equipment** — (`loadEquipment`, `unloadEquipment`, `toggleEquipmentValidation`).
- **Airway** — (`intubation`, `supraglotticAirway`).
- **CPR** — (`CPRCompressions`, `CPRReceive`).
- **Animation** — IK / info (e.g. `ikCommand`, `clearIkTargetsAll`, `characterInfo`).
- **Injury** — (`ShowInjuryType`, `tourniquetRequirement`).

## Tool Metadata

None suggested — `tool-metadata.json` is an empty list in this scrape.

## Open questions

- **Neonatal vs Pediatric:** Neonatal is real (newborn cores + baby IVs/hats) but authors may prefer one **Pediatric** global and age tags only on Characters.
- **Field vs Military on Environments:** Many outdoor beds are military (`destroyed_city`, `desert_village`); a separate **Field** tag is only worth it if civilian wilderness (cliff, mountain road, beach) should filter without Military.
- **Medication classes** need a pharmacy SME. The list above is name-token clustering, not a formulary. Overlap is real (Epinephrine is ACLS and vasopressor; Magnesium is electrolyte and obstetric).
- **Injury Presentation** on Characters vs Global **Trauma:** I kept anatomy variants (amputation, facial trauma, TBI mesh) type-scoped so Trauma can still mean “use in trauma cases” on tools/envs.
- **Soiled** clothing is useful but is a condition, not a garment slot — confirm authors want it.
- **Hair** on Equipment is a large, non-clinical slice (~56). Could live under an **Appearance** tag instead if you do not want it next to IVs.
- **Space Force / Orion** has dedicated tool, equipment, and clothing folders but is a small catalog — I left it out rather than padding.
- **Invisible / utility tools** (anchors, location markers) are engineer-facing; a **Utility** tag was almost proposed and skipped.
- **Interactions** may not be worth tagging at all if the UI already searches location. Body regions help only if you want coarse filters.
- **Review states** (Deprecated, Internal, Ready) would be excellent globals but there is no catalog signal yet except WIP/DEMO prefixes on some scenarios.
- **Tool Metadata** and **Scenes** should be revisited after the next scrape.
