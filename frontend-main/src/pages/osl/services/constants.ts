// @ts-nocheck
import type { ShipmentData } from './types';

export const HISTORICAL_DATA: ShipmentData[] = [
    {
        request_reference: "REQ-2023-001",
        origin: "Dubai, UAE",
        origin_longitude: 55.2708,
        origin_latitude: 25.2048,
        destination: "Juba, South Sudan",
        destination_longitude: 31.5713,
        destination_latitude: 4.8517,
        weight_kg: 5000,
        volume_cbm: 12,
        cargo_description: "Medical Kits",
        freight_carrier: "Emirates SkyCargo",
        cost_usd: 15400,
        transit_days: 3,
        on_time: true,
        forwarder: "Kuehne Nagel"
    },
    {
        request_reference: "REQ-2023-002",
        origin: "Copenhagen, Denmark",
        origin_longitude: 12.5683,
        origin_latitude: 55.6761,
        destination: "Kinshasa, DR Congo",
        destination_longitude: 15.307,
        destination_latitude: -4.4419,
        weight_kg: 8000,
        volume_cbm: 20,
        cargo_description: "Vaccines",
        freight_carrier: "DHL Aviation",
        cost_usd: 28000,
        transit_days: 5,
        on_time: true,
        forwarder: "DHL Global Forwarding"
    },
    {
        request_reference: "REQ-2023-003",
        origin: "Dubai, UAE",
        origin_longitude: 55.2708,
        origin_latitude: 25.2048,
        destination: "Juba, South Sudan",
        destination_longitude: 31.5713,
        destination_latitude: 4.8517,
        weight_kg: 3000,
        volume_cbm: 8,
        cargo_description: "PPE Supplies",
        freight_carrier: "Ethiopian Airlines",
        cost_usd: 12000,
        transit_days: 4,
        on_time: false,
        forwarder: "Maersk Logistics"
    }
];

