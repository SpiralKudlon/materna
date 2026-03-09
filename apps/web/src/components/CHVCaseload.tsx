import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { useToast } from '../hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { Search, Filter, CheckCircle } from 'lucide-react';

export type RiskTier = 'LOW' | 'MODERATE' | 'HIGH' | 'UNSCORED';
export type ReferralStatus = 'PENDING' | 'ACCEPTED' | 'TRANSFERRED' | 'CLOSED';

export interface CaseloadPatient {
    id: string;
    patientId: string;
    name: string;
    riskTier: RiskTier;
    lastContactAt: string;
    status: ReferralStatus;
}

// Temporary mock data for UI implementation
const MOCK_DATA: CaseloadPatient[] = [
    { id: '1', patientId: 'p1', name: 'Aisha Mwangi', riskTier: 'HIGH', lastContactAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), status: 'PENDING' },
    { id: '2', patientId: 'p2', name: 'Fatuma Hassan', riskTier: 'MODERATE', lastContactAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), status: 'PENDING' },
    { id: '3', patientId: 'p3', name: 'Mary Wanjiku', riskTier: 'LOW', lastContactAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(), status: 'ACCEPTED' },
    { id: '4', patientId: 'p4', name: 'Grace Ochieng', riskTier: 'HIGH', lastContactAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), status: 'PENDING' },
];

export function CHVCaseload() {
    const { toast } = useToast();
    const [patients, setPatients] = useState<CaseloadPatient[]>(MOCK_DATA);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterHighRisk, setFilterHighRisk] = useState(false);

    // Filter and search logic
    const filteredPatients = useMemo(() => {
        return patients.filter((p) => {
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesTier = filterHighRisk ? p.riskTier === 'HIGH' : true;
            return matchesSearch && matchesTier;
        });
    }, [patients, searchQuery, filterHighRisk]);

    // Format risk badge color
    const getRiskBadgeVariant = (tier: RiskTier) => {
        switch (tier) {
            case 'HIGH': return 'destructive';
            case 'MODERATE': return 'default'; // yellow via tailwind overrides if needed
            case 'LOW': return 'secondary';
            default: return 'outline';
        }
    };

    // Optimistic Update Workflow
    const handleAcceptReferral = async (referralId: string) => {
        // Find the patient to keep a backup in case of network failure
        const targetIndex = patients.findIndex(p => p.id === referralId);
        if (targetIndex === -1) return;

        const previousPatient = patients[targetIndex];

        // 1. Optimistic Update (Immediate UI response)
        const updatedPatients = [...patients];
        updatedPatients[targetIndex] = { ...previousPatient, status: 'ACCEPTED' };
        setPatients(updatedPatients);

        toast({
            title: "Accepted",
            description: `Referral for ${previousPatient.name} accepted locally.`,
        });

        // 2. Network Request
        try {
            // Simulated network delay
            await new Promise((resolve, reject) => {
                setTimeout(() => {
                    // Simulate chance of network failure to show reversion (e.g. 10% fail chance)
                    if (Math.random() > 0.9) reject(new Error('Network error'));
                    resolve(true);
                }, 800);
            });

            // If real network was here:
            // await api.patch(`/referrals/${referralId}/accept`);

            toast({
                title: "Sync Confirmed",
                description: `Referral synchronized with facility backend.`,
                variant: 'default',
            });

        } catch (err) {
            // 3. Rollback on Failure
            const rolledBackPatients = [...patients];
            rolledBackPatients[targetIndex] = previousPatient;
            setPatients(rolledBackPatients);

            toast({
                title: "Failed to Accept",
                description: "Network error occurred. The referral was reverted to PENDING.",
                variant: "destructive"
            });
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search patient name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8"
                    />
                </div>
                <Button
                    variant={filterHighRisk ? 'default' : 'outline'}
                    onClick={() => setFilterHighRisk(!filterHighRisk)}
                    className="w-full sm:w-auto gap-2"
                >
                    <Filter className="h-4 w-4" />
                    {filterHighRisk ? 'Showing High Risk' : 'Filter High Risk'}
                </Button>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Patient Name</TableHead>
                            <TableHead>Risk Tier</TableHead>
                            <TableHead>Last Contact</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredPatients.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                    No patients found matching your criteria.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredPatients.map((patient) => (
                                <TableRow key={patient.id}>
                                    <TableCell className="font-medium">{patient.name}</TableCell>
                                    <TableCell>
                                        <Badge variant={getRiskBadgeVariant(patient.riskTier)}>
                                            {patient.riskTier}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {formatDistanceToNow(new Date(patient.lastContactAt), { addSuffix: true })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {patient.status === 'PENDING' ? (
                                            <Button
                                                size="sm"
                                                onClick={() => handleAcceptReferral(patient.id)}
                                            >
                                                Accept
                                            </Button>
                                        ) : (
                                            <div className="flex items-center justify-end gap-1 text-sm text-green-600 font-medium">
                                                <CheckCircle className="h-4 w-4" />
                                                Accepted
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
