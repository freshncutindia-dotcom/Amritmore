"""One-shot script to bulk-import Mumbai pincodes from the user-uploaded zone map."""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

MUMBAI = [
    # (pincode, short area label used in UI)
    ("400001", "Fort / Colaba"),
    ("400002", "Kalbadevi"),
    ("400003", "Mandvi"),
    ("400004", "Girgaon"),
    ("400005", "Colaba"),
    ("400006", "Malabar Hill"),
    ("400007", "Grant Road"),
    ("400008", "Mumbai Central"),
    ("400009", "Chinchbunder"),
    ("400010", "Mazgaon"),
    ("400011", "Jacob Circle"),
    ("400012", "Parel"),
    ("400013", "Lower Parel"),
    ("400014", "Dadar East"),
    ("400015", "Sewri"),
    ("400016", "Mahim"),
    ("400017", "Dharavi"),
    ("400018", "Worli"),
    ("400019", "Matunga"),
    ("400020", "Marine Lines"),
    ("400021", "Nariman Point"),
    ("400022", "Sion"),
    ("400023", "Hutatma Chowk"),
    ("400050", "Bandra West"),
    ("400051", "Bandra East"),
    ("400052", "Khar"),
    ("400053", "Andheri West"),
    ("400054", "Santacruz West"),
    ("400055", "Santacruz East"),
    ("400056", "Vile Parle West"),
    ("400057", "Vile Parle East"),
    ("400058", "Andheri East"),
    ("400059", "JB Nagar"),
    ("400060", "MIDC Andheri"),
    ("400061", "SEEPZ"),
    ("400062", "Sahar / Airport"),
    ("400063", "Jogeshwari East"),
    ("400064", "Malad West"),
    ("400065", "Aarey"),
    ("400066", "Borivali East"),
    ("400067", "Kandivali West"),
    ("400068", "Dahisar West"),
    ("400069", "Andheri (E)"),
    ("400070", "Kurla West"),
    ("400071", "Chembur"),
    ("400072", "Sakinaka"),
    ("400073", "Marol"),
    ("400074", "Chembur Camp"),
    ("400075", "Pant Nagar"),
    ("400076", "Powai"),
    ("400077", "Ghatkopar East"),
    ("400078", "Bhandup West"),
    ("400079", "Vikhroli East"),
    ("400080", "Mulund West"),
    ("400081", "Mulund East"),
    ("400082", "Bhandup East"),
    ("400083", "Vikhroli"),
    ("400084", "Kurla East"),
    ("400085", "Ghatkopar West"),
    ("400086", "NITIE Powai"),
    ("400087", "Deonar"),
    ("400088", "Tilak Nagar"),
    ("400089", "Chembur East"),
    ("400090", "Borivali West"),
    ("400091", "Borivali W"),
    ("400092", "Borivali West II"),
    ("400093", "Andheri East II"),
    ("400094", "Anushakti Nagar"),
    ("400095", "Gorai"),
    ("400097", "Malad East"),
    ("400099", "Vile Parle E"),
    ("400100", "Kandivali East"),
    ("400101", "Kandivali East II"),
    ("400102", "Jogeshwari West"),
    ("400104", "Motilal Nagar"),
]

# Fee & ETA are the same for all Mumbai pincodes for now (can be zone-tiered later)
DEFAULT_FEE = 29
DEFAULT_ETA = 6

async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    inserted, updated = 0, 0
    for pc, area in MUMBAI:
        res = await db.pincodes.update_one(
            {"pincode": pc},
            {"$set": {"pincode": pc, "area": area, "delivery_fee": float(DEFAULT_FEE), "eta_hours": DEFAULT_ETA, "serviceable": True}},
            upsert=True,
        )
        if res.upserted_id:
            inserted += 1
        elif res.modified_count:
            updated += 1
    total = await db.pincodes.count_documents({})
    print(f"✓ Inserted {inserted}, updated {updated}. Total pincodes now: {total}")
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
