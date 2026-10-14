/* =====================================================================
   PMO Dashboard - demo data
   Three example projects used by "Load demo data" / "Reset demo data":
     PMO-001  At Risk   (slightly behind schedule, medium risk score)
     PMO-002  On Track  (ahead of schedule, within budget)
     PMO-003  Critical  (behind schedule, over budget, high risks, critical issues)
   This data is only copied into database.json when the user asks for it.
   ===================================================================== */

const SAMPLE_DB = {
  projects: [
    {"id":"PMO-001","name":"Solar Powered Parking Shade Construction Project","manager":"Ayesha Khan","dept":"Administration","desc":"Installation of solar-powered parking shades to provide covered parking and support renewable energy usage on campus.","phase":"Execution","status":"In Progress","budget":40000000,"planned":38000000,"actual":18000000,"start":"2026-03-01","end":"2027-02-28","pp":60,"ap":52,"update":"Steel structures installed in Block A. Solar panel delivery is delayed by two weeks at the port.","createdAt":"2026-10-14T00:00:00.000Z","updatedAt":"2026-10-14T00:00:00.000Z","completedAt":null},
    {"id":"PMO-002","name":"Campus Network Upgrade Project","manager":"Usman Ali","dept":"Information Technology","desc":"Upgrade of campus network infrastructure, switches, access points and network monitoring systems.","phase":"Monitoring","status":"In Progress","budget":30000000,"planned":29000000,"actual":20000000,"start":"2026-05-01","end":"2026-12-31","pp":70,"ap":72,"update":"Core switches replaced in all academic blocks. Monitoring dashboard is under final testing.","createdAt":"2026-10-14T00:00:00.000Z","updatedAt":"2026-10-14T00:00:00.000Z","completedAt":null},
    {"id":"PMO-003","name":"Digital Student Portal Implementation","manager":"Bilal Ahmed","dept":"Student Affairs","desc":"Implementation of a centralized digital portal for student academic and administrative services.","phase":"Execution","status":"At Risk","budget":30000000,"planned":32000000,"actual":31000000,"start":"2026-02-01","end":"2026-12-15","pp":75,"ap":55,"update":"Online fee payment is failing in testing and legacy student data needs cleaning before migration.","createdAt":"2026-10-14T00:00:00.000Z","updatedAt":"2026-10-14T00:00:00.000Z","completedAt":null}
  ],
  risks: [
    {"id":"R-001","projectId":"PMO-001","desc":"Supplier delivery delays for solar panels","cat":"Schedule","prob":"Medium","impact":"Medium","level":"Medium","mit":"Confirm a backup supplier and track shipment weekly","status":"Open"},
    {"id":"R-002","projectId":"PMO-001","desc":"Rain may delay civil works","cat":"External","prob":"Low","impact":"Medium","level":"Low","mit":"Plan indoor electrical work for rainy days","status":"Open"},
    {"id":"R-003","projectId":"PMO-001","desc":"Minor design changes requested by administration","cat":"Scope","prob":"Low","impact":"Low","level":"Low","mit":"Use a change request form for every design change","status":"Mitigating"},
    {"id":"R-004","projectId":"PMO-002","desc":"Key network engineer may be unavailable","cat":"Resource","prob":"Medium","impact":"Medium","level":"Medium","mit":"Train a second engineer on the new switches","status":"Mitigating"},
    {"id":"R-005","projectId":"PMO-002","desc":"Short downtime during switch migration","cat":"Technical","prob":"Low","impact":"Medium","level":"Low","mit":"Schedule migration on weekends","status":"Open"},
    {"id":"R-006","projectId":"PMO-002","desc":"Late delivery of access points","cat":"Schedule","prob":"Low","impact":"Low","level":"Low","mit":"Access points received and installed","status":"Resolved"},
    {"id":"R-007","projectId":"PMO-003","desc":"Integration with the legacy student information system may fail","cat":"Technical","prob":"High","impact":"High","level":"High","mit":"Build and test the integration early with real sample data","status":"Open"},
    {"id":"R-008","projectId":"PMO-003","desc":"Scope creep from new stakeholder requests","cat":"Scope","prob":"High","impact":"Medium","level":"High","mit":"Freeze scope and route new requests through change control","status":"Open"},
    {"id":"R-009","projectId":"PMO-003","desc":"Data migration errors from old records","cat":"Technical","prob":"Medium","impact":"High","level":"High","mit":"Clean data and run trial migrations before go-live","status":"Mitigating"},
    {"id":"R-010","projectId":"PMO-003","desc":"Budget overrun on licensing costs","cat":"Cost","prob":"Medium","impact":"Medium","level":"Medium","mit":"Negotiate licence price and review the cost plan","status":"Open"},
    {"id":"R-011","projectId":"PMO-003","desc":"Key developer resignation","cat":"Resource","prob":"Low","impact":"High","level":"Medium","mit":"Document code and pair developers on critical modules","status":"Open"},
    {"id":"R-012","projectId":"PMO-003","desc":"Low student adoption after launch","cat":"External","prob":"Low","impact":"Medium","level":"Low","mit":"Run awareness sessions and provide a help desk","status":"Open"}
  ],
  issues: [
    {"id":"I-001","projectId":"PMO-001","desc":"Solar panel shipment held at the port","severity":"Medium","resolution":"Coordinate with the supplier and customs agent to clear the shipment","status":"Open","createdAt":"2026-10-10T00:00:00.000Z"},
    {"id":"I-002","projectId":"PMO-002","desc":"Firmware bug on new access points","severity":"Low","resolution":"Firmware updated by the vendor","status":"Resolved","createdAt":"2026-09-20T00:00:00.000Z"},
    {"id":"I-003","projectId":"PMO-003","desc":"Online fee payment fails during testing","severity":"Critical","resolution":"Work with the bank to fix the payment gateway settings and retest","status":"Open","createdAt":"2026-10-05T00:00:00.000Z"},
    {"id":"I-004","projectId":"PMO-003","desc":"Duplicate records in legacy student data","severity":"Critical","resolution":"Remove duplicates and verify data before migration","status":"In Progress","createdAt":"2026-10-01T00:00:00.000Z"},
    {"id":"I-005","projectId":"PMO-003","desc":"Login page is slow under load","severity":"Medium","resolution":"Optimize the login query and add caching","status":"Open","createdAt":"2026-10-08T00:00:00.000Z"}
  ],
  comments: [
    {"id":"C-001","projectId":"PMO-001","author":"Ayesha Khan","type":"Progress Update","text":"Steel structures for Block A parking are installed. Foundation work for Block B has started.","at":"2026-10-08T10:30:00.000Z"},
    {"id":"C-002","projectId":"PMO-001","author":"PMO Office","type":"Comment","text":"Please share the revised delivery date for the solar panels in the next meeting.","at":"2026-10-11T14:15:00.000Z"},
    {"id":"C-003","projectId":"PMO-002","author":"Usman Ali","type":"Progress Update","text":"Core switches replaced in all academic blocks. Monitoring dashboard is in final testing.","at":"2026-10-10T09:00:00.000Z"},
    {"id":"C-004","projectId":"PMO-003","author":"Bilal Ahmed","type":"Progress Update","text":"Fee payment testing failed twice. Bank technical team is reviewing the gateway settings.","at":"2026-10-09T11:45:00.000Z"},
    {"id":"C-005","projectId":"PMO-003","author":"PMO Office","type":"Comment","text":"Project is over budget. A cost review meeting is scheduled for next week.","at":"2026-10-12T16:20:00.000Z"}
  ]
};
