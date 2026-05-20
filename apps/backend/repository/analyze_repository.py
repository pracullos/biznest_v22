from __future__ import annotations

from sqlalchemy.orm import Session
from sqlalchemy import distinct, text

from models.city import City
from models.zoning_area import ZoningArea
from models.hazard_area import HazardArea


class AnalyzeRepository:

    def __init__(self, db: Session):
        self.db = db

    def get_city(self, city_id: str) -> City | None:
        return self.db.query(City).filter(City.id == city_id).first()

    def get_zone_types(self, city_id: str) -> list[str]:
        rows = (
            self.db.query(distinct(ZoningArea.zone_type))
            .filter(ZoningArea.city_id == city_id, ZoningArea.zone_type.isnot(None))
            .all()
        )
        return [r[0] for r in rows if r[0]]

    def get_hazard_summary(self, city_id: str) -> list[dict]:
        rows = (
            self.db.query(distinct(HazardArea.hazard_type), HazardArea.scenario)
            .filter(HazardArea.city_id == city_id)
            .all()
        )
        seen: dict[str, set] = {}
        for hazard_type, scenario in rows:
            seen.setdefault(hazard_type, set())
            if scenario:
                seen[hazard_type].add(scenario)
        return [
            {"hazard_type": ht, "scenarios": sorted(sc)}
            for ht, sc in seen.items()
        ]

    # ── Spatial / location queries ────────────────────────────────────────────

    def get_zones_at_geometry(
        self, city_id: str, geojson: str, geo_type: str, buffer_m: int
    ) -> list[dict]:
        """Zone types within or near the geometry. Uses DWithin for Point, Intersects for polygon."""
        if geo_type == "Point":
            sql = text("""
                SELECT zone_type, COUNT(*) AS cnt, AVG(severity) AS avg_sev
                FROM zoning_areas
                WHERE city_id = CAST(:city_id AS uuid)
                  AND geometry IS NOT NULL
                  AND ST_DWithin(
                      geometry::geography,
                      ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 4326)::geography,
                      :buffer
                  )
                GROUP BY zone_type
                ORDER BY cnt DESC
                LIMIT 15
            """)
            params: dict = {"city_id": city_id, "geojson": geojson, "buffer": buffer_m}
        else:
            sql = text("""
                SELECT zone_type, COUNT(*) AS cnt, AVG(severity) AS avg_sev
                FROM zoning_areas
                WHERE city_id = CAST(:city_id AS uuid)
                  AND geometry IS NOT NULL
                  AND ST_Intersects(
                      geometry,
                      ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 4326)
                  )
                GROUP BY zone_type
                ORDER BY cnt DESC
                LIMIT 15
            """)
            params = {"city_id": city_id, "geojson": geojson}

        rows = self.db.execute(sql, params).fetchall()
        return [
            {
                "zone_type": r[0],
                "count": int(r[1]),
                "avg_severity": float(r[2]) if r[2] is not None else None,
            }
            for r in rows
        ]

    def get_hazards_at_geometry(
        self, city_id: str, geojson: str, geo_type: str, buffer_m: int
    ) -> list[dict]:
        """Hazard types intersecting/within geometry, aggregated by hazard_type."""
        if geo_type == "Point":
            sql = text("""
                SELECT hazard_type, scenario, AVG(severity) AS avg_sev
                FROM hazard_areas
                WHERE city_id = CAST(:city_id AS uuid)
                  AND geometry IS NOT NULL
                  AND ST_DWithin(
                      geometry::geography,
                      ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 4326)::geography,
                      :buffer
                  )
                GROUP BY hazard_type, scenario
                ORDER BY hazard_type, scenario
            """)
            params: dict = {"city_id": city_id, "geojson": geojson, "buffer": buffer_m}
        else:
            sql = text("""
                SELECT hazard_type, scenario, AVG(severity) AS avg_sev
                FROM hazard_areas
                WHERE city_id = CAST(:city_id AS uuid)
                  AND geometry IS NOT NULL
                  AND ST_Intersects(
                      geometry,
                      ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 4326)
                  )
                GROUP BY hazard_type, scenario
                ORDER BY hazard_type, scenario
            """)
            params = {"city_id": city_id, "geojson": geojson}

        rows = self.db.execute(sql, params).fetchall()

        seen: dict[str, dict] = {}
        for hazard_type, scenario, avg_sev in rows:
            if hazard_type not in seen:
                seen[hazard_type] = {"scenarios": set(), "severities": []}
            if scenario:
                seen[hazard_type]["scenarios"].add(scenario)
            if avg_sev is not None:
                seen[hazard_type]["severities"].append(float(avg_sev))

        return [
            {
                "hazard_type": ht,
                "scenarios": sorted(v["scenarios"]),
                "avg_severity": (
                    round(sum(v["severities"]) / len(v["severities"]), 2)
                    if v["severities"] else None
                ),
            }
            for ht, v in seen.items()
        ]

    def get_establishments_at_geometry(
        self, city_id: str, geojson: str, geo_type: str, buffer_m: int
    ) -> list[dict]:
        """Establishments near/within geometry, grouped by category."""
        if geo_type == "Point":
            sql = text("""
                SELECT category, COUNT(*) AS cnt
                FROM establishments
                WHERE city_id = CAST(:city_id AS uuid)
                  AND location IS NOT NULL
                  AND ST_DWithin(
                      location::geography,
                      ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 4326)::geography,
                      :buffer
                  )
                GROUP BY category
                ORDER BY cnt DESC
                LIMIT 10
            """)
            params: dict = {"city_id": city_id, "geojson": geojson, "buffer": buffer_m}
        else:
            sql = text("""
                SELECT category, COUNT(*) AS cnt
                FROM establishments
                WHERE city_id = CAST(:city_id AS uuid)
                  AND location IS NOT NULL
                  AND ST_Intersects(
                      location,
                      ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 4326)
                  )
                GROUP BY category
                ORDER BY cnt DESC
                LIMIT 10
            """)
            params = {"city_id": city_id, "geojson": geojson}

        rows = self.db.execute(sql, params).fetchall()
        return [{"category": r[0], "count": int(r[1])} for r in rows]