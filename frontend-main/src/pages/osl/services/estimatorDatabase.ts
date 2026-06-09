// @ts-nocheck
import { HazardData, Hazard } from './types';

export const HAZARDS: Hazard[] = ['cholera', 'ebola', 'mpox', 'lassa', 'diphtheria'];

// This is the canonical database built from the "Essential Items Estimator" documents.
export const ESTIMATOR_DB: Record<string, HazardData> = {
    mpox: {
        params: { number_of_beds: 1000, expected_patients_per_week: 25, period_weeks: 16 },
        medicines: [
             { description: 'AMOXICILLIN 400mg / CLAVUL.ac. 57mg/5ml, oral susp.', category: 'Medicines', need: 0, unit: 'bottle', assumption: '20 for 100 patients', cost: 3.85 },
             { description: 'AMOXICILLIN 1g / CLAVULANIC acid 200mg, powder', category: 'Medicines', need: 0, unit: 'vial', assumption: '100 for 100 patients', cost: 1.045 },
             { description: 'CEFTRIAXONE sodium, eq. 1g base, powder, vial', category: 'Medicines', need: 0, unit: 'vial', assumption: '50 for 100 patients', cost: 0.33 },
             { description: 'DOXYCYCLINE salt, eq. 100mg base, tab.', category: 'Medicines', need: 0, unit: 'tab', assumption: '400 for 100 patients', cost: 0.033 },
             { description: 'LIDOCAINE, 2%, jelly, sterile, tube', category: 'Medicines', need: 0, unit: 'tube', assumption: '300 for 100 patients', cost: 13.20 },
             { description: 'ORAL REHYDRATION SALTS (ORS) low osmol.', category: 'Medicines', need: 0, unit: 'sachet', assumption: '100 for 100 patients', cost: 0.099 },
        ],
        devices: [
            { description: 'PULSE OXYMETER', category: 'Medical Devices', need: 0, unit: 'unit', assumption: '1 Per bed' },
            { description: 'O2 CONCENTRATOR (BEDSIDE)', category: 'Medical Devices', need: 0, unit: 'unit', assumption: '0.5 Per bed' },
            { description: 'FLOWMETER - THORPE TUBE, FOR OXYGEN, 0-15 LPM', category: 'Medical Devices', need: 0, unit: 'unit', assumption: '2 Per bed' },
            { description: 'SYRINGE PUMP WITH ACCESSORIES', category: 'Medical Devices', need: 0, unit: 'unit', assumption: '2 Per bed' },
            { description: 'INFUSION PUMP WITH ACCESSORIES', category: 'Medical Devices', need: 0, unit: 'unit', assumption: '1 Per bed' },
        ],
        ppe: [
            { description: 'GOGGLES PROTECTIVE, wraparound, soft frame', category: 'PPE', need: 0, unit: 'unit', assumption: '4 Per bed' },
            { description: 'GOWN, AAMI level 1, non sterile, disp., size M', category: 'PPE', need: 0, unit: 'unit', assumption: '6.3 Per bed month' },
            { description: 'GLOVE EXAMINATION, nitrile, pf, size M', category: 'PPE', need: 0, unit: 'unit', assumption: '42 Per bed month' },
            { description: 'RESPIRATOR, mask, FFP2/N95, type IIR', category: 'PPE', need: 0, unit: 'unit', assumption: '60 Per bed month' },
            { description: 'FACE SHIELD, clear plastic, disp.', category: 'PPE', need: 0, unit: 'unit', assumption: '27 Per bed month' },
        ],
        logistics: [
            { description: 'BODY BAG, plastic, white, 400 microns, ad., 250x120cm', category: 'Logistics', need: 0, unit: 'unit', assumption: '0.5 Per bed month' },
            { description: 'BAG biohazard, refuse 90 x 70 cm, 70 microns', category: 'Logistics', need: 0, unit: 'unit', assumption: '40 Per bed month' },
            { description: 'Chlorine (HTH or NADCC, in between 40 and 80%)', category: 'Logistics', need: 0, unit: 'kg', assumption: '20 Per bed month' },
        ],
        hr: [
            { profile: 'Physician MD', need: 0, variable: 'Per number of beds per shift', value: '1 (1 per shift, every 8 beds)'},
            { profile: 'Nurse', need: 0, variable: 'Per number of beds per shift', value: '1 (1 per shift, every 4 beds)'},
            { profile: 'Hygienist', need: 0, variable: 'Per number of beds per shift', value: '1 (1 per shift, every 3 beds)'},
            { profile: 'WASH assistant', need: 0, variable: 'Per centre', value: '1'},
        ]
    },
    lassa: {
        params: { number_of_beds: 1000, expected_patients_per_week: 25, period_weeks: 16 },
        medicines: [
            { description: 'RIBAVIRIN 200mg, tab (assumed)', category: 'Medicines', need: 0, unit: 'tab', assumption: '28 for 100 patients', cost: 2.5 },
            { description: 'ASCORBIC ACID (Vitamin C), 250 mg.', category: 'Medicines', need: 0, unit: 'tablet', assumption: '1 for 100 patients', cost: 0.1 },
            { description: 'FUROSEMIDE, 10 mg/ml, 2 ml', category: 'Medicines', need: 0, unit: 'vial', assumption: '4 for 100 patients', cost: 0.5 },
            { description: 'GLUCOSE, 5%, 1 liter, soft bag', category: 'Medicines', need: 0, unit: 'bag', assumption: '1 for 100 patients', cost: 1.2 }
        ],
        devices: [
            { description: 'O2 CONCENTRATOR (BEDSIDE) - 10L', category: 'Medical Devices', need: 0, unit: 'unit', assumption: '1 Per bed'},
            { description: 'PATIENT MONITOR, MULTIPARAMETRIC WITHOUT ECG', category: 'Medical Devices', need: 0, unit: 'unit', assumption: '1 Per bed'},
            { description: 'INFUSION PUMP WITH ACCESSORIES', category: 'Medical Devices', need: 0, unit: 'unit', assumption: '1 Per bed'},
        ],
        ppe: [
            { description: 'Fluid-resistant medical or surgical mask', category: 'PPE', need: 0, unit: 'piece', assumption: '212.5 Per bed month' },
            { description: 'GOWN, AAMI level 3, non sterile, disp. M', category: 'PPE', need: 0, unit: 'piece', assumption: '4.25 Per bed month' },
            { description: 'GLOVE EXAMINATION, nitrile, pf, ext. cuff min. 28 cm, size M', category: 'PPE', need: 0, unit: 'pair', assumption: '595 Per bed month'},
            { description: 'Faceshield (single use)', category: 'PPE', need: 0, unit: 'piece', assumption: '170 Per bed month' },
        ],
        logistics: [
            { description: 'BAG biohazard, refuse 90 x 70 cm, 70 microns', category: 'Logistics', need: 0, unit: 'piece', assumption: '40 Per bed month'},
            { description: 'Safety box burnable 5l', category: 'Logistics', need: 0, unit: 'piece', assumption: '1.5 Per bed month' },
        ],
        hr: [
            { profile: 'Physician MD', need: 0, variable: 'Per number of beds per shift', value: '1 (1 per shift, every 8 beds)' },
            { profile: 'Nurse', need: 0, variable: 'Per number of beds per shift', value: '1 (1 per shift, every 4 beds)' },
            { profile: 'Hygienist', need: 0, variable: 'Per number of beds per shift', value: '1 (1 per shift, every 3 beds)' },
        ]
    },
    diphtheria: {
        params: { number_of_beds: 1000, expected_patients_per_week: 25, period_weeks: 16 },
        medicines: [
            { description: 'DIPHTHERIA ANTITOXIN, 10,000 IU/10ml, vial', category: 'Medicines', need: 0, unit: 'vial', assumption: '4 for 100 patients', cost: 50.0 },
            { description: 'ERYTHROMYCIN stearate, eq. 500mg base, tab.', category: 'Medicines', need: 0, unit: 'tab', assumption: '2.24 for 100 patients', cost: 0.2 },
            { description: 'EPINEPHRINE (adrenaline) tartrate, eq. 1mg/ml base, 1ml, amp', category: 'Medicines', need: 0, unit: 'amp', assumption: '0.1 for 100 patients', cost: 0.5 },
        ],
        devices: [
            { description: 'VENTILATOR FOR INTENSIVE CARE UNIT', category: 'Medical Devices', need: 0, unit: 'unit', assumption: '0.01 Per bed'}, // 10 per 1000
            { description: 'LARYNGOSCOPE, FO, DIAMETER 28 mm, WITH BLADES', category: 'Medical Devices', need: 0, unit: 'unit', assumption: '8 Per centre' },
            { description: 'Airway, Oropharyngeal, Guedel, set with sizes', category: 'Medical Devices', need: 0, unit: 'set', assumption: '20 Per month' },
        ],
        ppe: [
            { description: 'MASK SURGICAL, type IIR, level 2, s.u, non sterile, earloop, size L', category: 'PPE', need: 0, unit: 'unit', assumption: '20 Per bed month' },
            { description: 'GLOVE EXAMINATION, nitrile, pf, size M', category: 'PPE', need: 0, unit: 'unit', assumption: '42 Per bed month' },
        ],
        logistics: [
            { description: 'Hand wash soap, 250ml bottle', category: 'Logistics', need: 0, unit: 'bottle', assumption: '8 Per bed month' },
            { description: 'Paper towels (roll)', category: 'Logistics', need: 0, unit: 'roll', assumption: '50 Per bed' },
        ],
        hr: [
            { profile: 'Physician MD', need: 0, variable: 'Per number of beds per shift', value: '1 (1 per shift, every 8 beds)' },
            { profile: 'Nurse', need: 0, variable: 'Per number of beds per shift', value: '1 (1 per shift, every 4 beds)' },
        ]
    },
     cholera: {
         params: { number_of_beds: 120, expected_patients_per_week: 75, period_weeks: 12 },
         medicines: [
            {
                description: 'ORAL REHYDRATION SALTS (ORS) low osmol.',
                category: 'Medicines',
                need: 0,
                unit: 'sachet',
                assumption: '100 sachets per 100 cholera patients',
                cost: 0.099,
                priority: 'HIGH',
                calculation: { type: 'per_hundred_patients', value: 100 }
            },
            {
                description: "Compound solution of sodium lactate (Ringer's lactate)",
                category: 'Medicines',
                need: 0,
                unit: '1L bag',
                assumption: '25 bags per 100 severe patients',
                cost: 1.76,
                priority: 'CRITICAL',
                calculation: { type: 'per_severe_patient', value: 0.25 }
            },
            {
                description: 'Infusion giving set, sterile, single-use',
                category: 'Medicines',
                need: 0,
                unit: 'unit',
                assumption: '14 sets per 100 severe patients',
                cost: 0.32,
                priority: 'CRITICAL',
                calculation: { type: 'per_severe_patient', value: 0.14 }
            },
            {
                description: 'Zinc sulphate, dispersible tablets 20mg',
                category: 'Medicines',
                need: 0,
                unit: 'tablet',
                assumption: '30 tablets per 100 patients',
                cost: 0.045,
                priority: 'HIGH',
                calculation: { type: 'per_hundred_patients', value: 30 }
            },
            {
                description: 'DOXYCYCLINE salt, eq. 100mg base, tab.',
                category: 'Medicines',
                need: 0,
                unit: 'tablet',
                assumption: '200 tablets per 100 patients',
                cost: 0.033,
                priority: 'MEDIUM',
                calculation: { type: 'per_hundred_patients', value: 200 }
            },
            {
                description: 'Azithromycin 500mg tablet',
                category: 'Medicines',
                need: 0,
                unit: 'tablet',
                assumption: '100 tablets per 100 severe patients',
                cost: 0.21,
                priority: 'HIGH',
                calculation: { type: 'per_severe_patient', value: 1 }
            }
         ],
         devices: [
            {
                description: 'Cholera cot with bucket and IV pole',
                category: 'Medical Devices',
                need: 0,
                unit: 'unit',
                assumption: '1 cot per 5 severe patients',
                cost: 76.0,
                priority: 'HIGH',
                calculation: { type: 'per_severe_patient', value: 0.2 }
            },
            {
                description: 'Solar lantern with USB charging',
                category: 'Medical Devices',
                need: 0,
                unit: 'unit',
                assumption: '1 lantern per 10 severe patients',
                cost: 18.5,
                priority: 'MEDIUM',
                calculation: { type: 'per_severe_patient', value: 0.1 }
            }
         ],
         ppe: [
            {
                description: 'Gloves, examination, nitrile, medium, single-use',
                category: 'PPE',
                need: 0,
                unit: 'pair',
                assumption: '120 pairs per bed month',
                cost: 0.15,
                priority: 'HIGH',
                calculation: { type: 'per_bed_month', value: 120 }
            },
            {
                description: 'Apron, reusable, heavy duty non-woven',
                category: 'PPE',
                need: 0,
                unit: 'unit',
                assumption: '15 aprons per month',
                cost: 6.5,
                priority: 'MEDIUM',
                calculation: { type: 'per_week', value: 3.75 }
            }
         ],
         logistics: [
            {
                description: 'Water purification tablet (NaDCC 67mg)',
                category: 'Logistics & WASH',
                need: 0,
                unit: 'tablet',
                assumption: '200 tablets per 100 patients',
                cost: 0.012,
                priority: 'HIGH',
                calculation: { type: 'per_hundred_patients', value: 200 }
            },
            {
                description: 'Chlorine (HTH) 70% granular',
                category: 'Logistics & WASH',
                need: 0,
                unit: 'kg',
                assumption: '25 kg per bed month',
                cost: 2.3,
                priority: 'HIGH',
                calculation: { type: 'per_bed_month', value: 25 }
            },
            {
                description: 'Body bag, adult size',
                category: 'Logistics & WASH',
                need: 0,
                unit: 'unit',
                assumption: '2 body bags per 100 patients',
                cost: 18.32,
                priority: 'MEDIUM',
                calculation: { type: 'per_hundred_patients', value: 2 },
                commodity_id: 'BODY_BAG_ADULT'
            }
         ],
         hr: [
            { profile: 'Cholera treatment nurse', need: 0, variable: 'Per shift', value: '6 nurses per shift', priority: 'CRITICAL' },
            { profile: 'WASH assistant', need: 0, variable: 'Per shift', value: '3 assistants per shift', priority: 'HIGH' }
         ],
     },
     ebola: {
         params: { number_of_beds: 100, expected_patients_per_week: 5, period_weeks: 16 },
         medicines: [ { description: 'RINGER lactate, 1l, flex. bag, PVC free', category: 'Medicines', need: 0, unit: 'bag', assumption: '50 for 100 patients', cost: 1.76 }],
         devices: [],
         ppe: [
            { description: 'COVERALL, fluid resist. cat III, type 5B/6B', category: 'PPE', need: 0, unit: 'unit', assumption: '85 Per bed month' },
            { description: 'GOWN, AAMI level 3, non sterile, disp. XL', category: 'PPE', need: 0, unit: 'unit', assumption: '12.75 Per bed month' },
         ],
         logistics: [ { description: 'BODY BAG, plastic, white, 400 microns, ad., 250x120cm', category: 'Logistics', need: 0, unit: 'unit', assumption: '1 Per bed month' }],
         hr: [
            { profile: 'Physician MD', need: 0, variable: 'Per number of beds per shift', value: '1 (1 per shift, every 5 beds)'},
            { profile: 'Nurse', need: 0, variable: 'Per number of beds per shift', value: '1 (1 per shift, every 2 beds)'},
         ]
    },
};

