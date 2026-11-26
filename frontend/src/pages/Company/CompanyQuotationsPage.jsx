import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileSpreadsheet,
  FileText,
  Calendar,
  Clock,
  MapPin,
  Users,
  Search,
  Filter,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  Send,
  Edit3,
  Copy,
  Printer,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Building,
  CreditCard,
  User,
  ShieldCheck,
  Tag,
  Trash2,
  ExternalLink,
  MessageSquare,
  Sparkles,
  HelpCircle,
  LayoutGrid,
  List,
  AlertTriangle,
  History,
  Layers,
  Check
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

// Quotation Status Configurations
const STATUS_CONFIG = {
  DRAFT: {
    label: 'Draft',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
    dot: 'bg-slate-400'
  },
  SENT: {
    label: 'Awaiting Response',
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    border: 'border-slate-200',
    dot: 'bg-slate-600'
  },
  CHANGE_REQUESTED: {
    label: 'Changes Requested',
    bg: 'bg-rose-50',
    text: 'text-rose-900',
    border: 'border-rose-200',
    dot: 'bg-[#F20047]'
  },
  ACCEPTED: {
    label: 'Accepted',
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    border: 'border-slate-200',
    dot: 'bg-slate-700'
  },
  REJECTED: {
    label: 'Declined',
    bg: 'bg-slate-50',
    text: 'text-slate-500',
    border: 'border-slate-200',
    dot: 'bg-slate-400'
  },
  EXPIRED: {
    label: 'Expired',
    bg: 'bg-slate-50',
    text: 'text-slate-500',
    border: 'border-slate-200',
    dot: 'bg-slate-400'
  },
  SUPERSEDED: {
    label: 'Superseded',
    bg: 'bg-slate-50',
    text: 'text-slate-500',
    border: 'border-slate-200',
    dot: 'bg-slate-400'
  }
};

const SERVICE_CATEGORIES = [
  'DECORATION',
  'CATERING',
  'PHOTOGRAPHY',
  'ENTERTAINMENT',
  'VENUE',
  'PLANNING',
  'SECURITY',
  'LOGISTICS',
  'AUDIO_VISUAL',
  'OTHER'
];

// Resolves itemized service lines with fallback hierarchy to guarantee proposal is never empty
export const resolveQuotationLineItems = (quote) => {
  if (!quote) return [];
  if (Array.isArray(quote.lineItems) && quote.lineItems.length > 0) {
    return quote.lineItems.map((li, idx) => ({
      id: li.id || `item-${idx}`,
      serviceTitle: li.serviceTitle || 'Quoted Deliverable',
      category: li.category || 'EVENT_SERVICE',
      deliverables: li.deliverables || li.notes || li.description || '',
      specialConditions: li.specialConditions || '',
      quantity: Number(li.quantity || 1),
      unitPrice: Number(li.unitPrice || 0),
      lineTotal: Number(li.lineTotal || (Number(li.unitPrice || 0) * Number(li.quantity || 1)))
    }));
  }
  return [];
};

export default function CompanyQuotationsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedBookingId = searchParams.get('bookingId');

  // Main Data State
  const [quotations, setQuotations] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [catalogServices, setCatalogServices] = useState([]);
  const [catalogPackages, setCatalogPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [eventTypeFilter, setEventTypeFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('DATE_DESC');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8);

  // Inspector & Modals State
  const [selectedQuotationId, setSelectedQuotationId] = useState(null);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Editor Modal State (Create or Edit Draft)
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [editorMode, setEditorMode] = useState('CREATE'); // 'CREATE' | 'EDIT_DRAFT' | 'REVISE'
  const [editingQuotationId, setEditingQuotationId] = useState(null);
  const [submittingQuote, setSubmittingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState('');

  // Editor Form State
  const [formData, setFormData] = useState({
    bookingId: '',
    items: [],
    discount: 0,
    taxAndFees: 0,
    paymentTerms: '50% initial payment upon signing; remaining 50% due after event completion.',
    notes: '',
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    revisionReason: ''
  });

  // Service Selector helper state inside Editor
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');

  // Print / Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewQuotation, setPreviewQuotation] = useState(null);
  const printableAreaRef = useRef(null);

  // Copy helper
  const [copiedRef, setCopiedRef] = useState(null);
  const copyToClipboard = (text, label = 'Reference') => {
    navigator.clipboard.writeText(text);
    setCopiedRef(text);
    toast.success(`Copied ${label} to clipboard.`);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  // Load Initial Data
  const loadData = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const [quotesRes, bookingsRes, servicesRes, packagesRes] = await Promise.allSettled([
        api.getQuotations(),
        api.getAllBookings('?limit=100'),
        api.getServices(),
        api.getPackages()
      ]);

      let loadedQuotations = [];
      if (quotesRes.status === 'fulfilled' && quotesRes.value?.data?.quotations) {
        loadedQuotations = quotesRes.value.data.quotations;
        setQuotations(loadedQuotations);
      } else {
        toast.error('Unable to load quotations registry.');
      }

      let loadedBookings = [];
      if (bookingsRes.status === 'fulfilled') {
        loadedBookings = bookingsRes.value?.data?.bookings || bookingsRes.value?.data || [];
        setBookings(loadedBookings);
      }

      if (servicesRes.status === 'fulfilled') {
        const servList = servicesRes.value?.data?.services || servicesRes.value?.data || [];
        setCatalogServices(servList);
      }

      if (packagesRes.status === 'fulfilled') {
        const packList = packagesRes.value?.data?.packages || packagesRes.value?.data || [];
        setCatalogPackages(packList);
      }

      // If user came via /company/quotations?bookingId=..., handle automatic loading
      if (preselectedBookingId && loadedBookings.length > 0) {
        const targetBooking = loadedBookings.find(b => b.id === preselectedBookingId);
        if (targetBooking) {
          // Check if booking already has an active quotation
          const existingQuote = loadedQuotations.find(q => q.bookingId === preselectedBookingId && ['DRAFT', 'SENT', 'ACCEPTED', 'CHANGE_REQUESTED'].includes(q.status));
          if (existingQuote) {
            setSelectedQuotationId(existingQuote.id);
            toast.info(`Booking ${targetBooking.reference} already has quotation v${existingQuote.version} (${existingQuote.status}).`);
          } else {
            initNewQuotationFromBooking(targetBooking);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load quotations data:', err);
      toast.error('Network error loading quotation information.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [preselectedBookingId]);

  // Load single quotation details when selected for inspection
  useEffect(() => {
    if (!selectedQuotationId) {
      setSelectedQuotation(null);
      return;
    }

    const fetchDetails = async () => {
      try {
        setLoadingDetails(true);
        const res = await api.getQuotationById(selectedQuotationId);
        setSelectedQuotation(res.data?.quotation || res.data);
      } catch (err) {
        console.error('Failed to load quotation details:', err);
        toast.error('Unable to load quotation details.');
      } finally {
        setLoadingDetails(false);
      }
    };

    fetchDetails();
  }, [selectedQuotationId]);

  // Calculate Summary KPI metrics from real backend data
  const summaryMetrics = useMemo(() => {
    const total = quotations.length;
    const drafts = quotations.filter(q => q.status === 'DRAFT').length;
    const sent = quotations.filter(q => q.status === 'SENT').length;
    const changeRequested = quotations.filter(q => q.status === 'CHANGE_REQUESTED').length;
    const accepted = quotations.filter(q => q.status === 'ACCEPTED').length;
    const expired = quotations.filter(q => {
      if (q.status === 'EXPIRED') return true;
      if (q.status === 'SENT' && q.expiresAt && new Date(q.expiresAt) < new Date()) return true;
      return false;
    }).length;

    return { total, drafts, sent, changeRequested, accepted, expired };
  }, [quotations]);

  // Filtered & Sorted Quotations List
  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const quoteRef = `qt-${q.booking?.reference}-v${q.version}`.toLowerCase();
        const bookingRef = (q.booking?.reference || '').toLowerCase();
        const eventTitle = (q.booking?.title || '').toLowerCase();
        const custName = (q.booking?.customer?.fullName || '').toLowerCase();
        const notes = (q.notes || '').toLowerCase();

        const match =
          quoteRef.includes(query) ||
          bookingRef.includes(query) ||
          eventTitle.includes(query) ||
          custName.includes(query) ||
          notes.includes(query);

        if (!match) return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'EXPIRED') {
          const isExp = q.status === 'EXPIRED' || (q.status === 'SENT' && q.expiresAt && new Date(q.expiresAt) < new Date());
          if (!isExp) return false;
        } else if (q.status !== statusFilter) {
          return false;
        }
      }

      // 3. Event Type Filter
      if (eventTypeFilter !== 'ALL' && q.booking?.eventType !== eventTypeFilter) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'DATE_DESC') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'DATE_ASC') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'AMOUNT_DESC') return Number(b.totalAmount) - Number(a.totalAmount);
      if (sortBy === 'AMOUNT_ASC') return Number(a.totalAmount) - Number(b.totalAmount);
      if (sortBy === 'EXPIRY_ASC') return new Date(a.expiresAt || '9999') - new Date(b.expiresAt || '9999');
      return 0;
    });
  }, [quotations, searchQuery, statusFilter, eventTypeFilter, sortBy]);

  // Pagination Calculations
  const totalPages = Math.ceil(filteredQuotations.length / itemsPerPage) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredQuotations.length);
  const paginatedQuotations = filteredQuotations.slice(startIndex, endIndex);

  // Initialize a new quotation pre-populated with booking data
  const initNewQuotationFromBooking = (booking) => {
    if (!booking) return;

    // Build initial proposed items from requested services or package
    const initialItems = [];

    // If booking has a requested package, add package items
    if (booking.package) {
      initialItems.push({
        id: `pkg-${Date.now()}`,
        serviceTitle: `${booking.package.name} (Curated Package)`,
        category: 'PLANNING',
        description: booking.package.description || 'Full comprehensive package arrangement',
        deliverables: Array.isArray(booking.package.inclusions)
          ? booking.package.inclusions.join(', ')
          : (booking.package.inclusions || 'All package items included'),
        quantity: 1,
        unitPrice: Number(booking.package.price) || 0,
        discount: 0,
        specialConditions: 'Subject to standard Eventora terms and partner schedule confirmation.',
        exclusions: Array.isArray(booking.package.exclusions) ? booking.package.exclusions.join(', ') : '',
        isPartnerConfirmed: true,
        notes: `Selected package for ${booking.guestCount} guests`
      });
    }

    // If booking has requested individual items
    if (Array.isArray(booking.items) && booking.items.length > 0) {
      booking.items.forEach((bi, idx) => {
        initialItems.push({
          id: `bi-${Date.now()}-${idx}`,
          serviceTitle: bi.service?.name || bi.title || 'Event Service Item',
          category: bi.service?.category || 'OTHER',
          description: bi.service?.description || 'Custom requested service deliverable',
          deliverables: bi.deliverables || 'Service provision for scheduled celebration.',
          quantity: bi.quantity || 1,
          unitPrice: Number(bi.unitPrice || bi.service?.startingPrice || 5000),
          discount: 0,
          specialConditions: '',
          exclusions: '',
          isPartnerConfirmed: false,
          notes: bi.notes || ''
        });
      });
    }

    // Default item if none existed
    if (initialItems.length === 0) {
      initialItems.push({
        id: `item-${Date.now()}-1`,
        serviceTitle: `${booking.eventType} Coordination & Event Management`,
        category: 'PLANNING',
        description: 'Comprehensive lead producer coordination, schedule creation, vendor briefing, and on-site oversight.',
        deliverables: 'Lead producer on-site, timeline sheet, vendor coordination, floor plan management.',
        quantity: 1,
        unitPrice: 25000,
        discount: 0,
        specialConditions: '',
        exclusions: '',
        isPartnerConfirmed: true,
        notes: ''
      });
    }

    setFormData({
      bookingId: booking.id,
      items: initialItems,
      discount: 0,
      taxAndFees: 0,
      paymentTerms: '50% initial payment upon contract signing; remaining 50% due after event completion.',
      notes: booking.specialRequirements
        ? `Customer Requirements: ${booking.specialRequirements}\nVenue: ${booking.locationName}`
        : `Official proposal for ${booking.title} (${booking.guestCount} guests) at ${booking.locationName}.`,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      revisionReason: ''
    });

    setEditorMode('CREATE');
    setEditingQuotationId(null);
    setQuoteError('');
    setEditorModalOpen(true);
  };

  // Open Editor to edit an existing DRAFT quotation
  const handleEditDraft = (quote) => {
    if (!quote || quote.status !== 'DRAFT') {
      toast.error('Only draft quotations can be edited directly. To alter an issued quote, create a new revision.');
      return;
    }

    setFormData({
      bookingId: quote.bookingId,
      items: quote.lineItems.map(item => ({
        id: item.id,
        serviceTitle: item.serviceTitle,
        category: item.category || 'OTHER',
        description: item.description || '',
        deliverables: item.deliverables || '',
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount || 0),
        specialConditions: item.specialConditions || '',
        exclusions: item.exclusions || '',
        isPartnerConfirmed: Boolean(item.isPartnerConfirmed),
        notes: item.notes || ''
      })),
      discount: Number(quote.discount || 0),
      taxAndFees: Number(quote.taxAndFees || 0),
      paymentTerms: quote.paymentTerms || '',
      notes: quote.notes || '',
      expiresAt: quote.expiresAt ? new Date(quote.expiresAt).toISOString().split('T')[0] : '',
      revisionReason: ''
    });

    setEditorMode('EDIT_DRAFT');
    setEditingQuotationId(quote.id);
    setQuoteError('');
    setEditorModalOpen(true);
  };

  // Open Editor to Revise an issued or changes-requested quotation (creates next version)
  const handleReviseQuotation = (quote) => {
    if (!quote) return;

    setFormData({
      bookingId: quote.bookingId,
      items: quote.lineItems.map(item => ({
        id: `rev-${item.id}-${Date.now()}`,
        serviceTitle: item.serviceTitle,
        category: item.category || 'OTHER',
        description: item.description || '',
        deliverables: item.deliverables || '',
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount || 0),
        specialConditions: item.specialConditions || '',
        exclusions: item.exclusions || '',
        isPartnerConfirmed: Boolean(item.isPartnerConfirmed),
        notes: item.notes || ''
      })),
      discount: Number(quote.discount || 0),
      taxAndFees: Number(quote.taxAndFees || 0),
      paymentTerms: quote.paymentTerms || '',
      notes: quote.notes || '',
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      revisionReason: quote.customerResponseNote ? `Addressing customer feedback: "${quote.customerResponseNote}"` : ''
    });

    setEditorMode('REVISE');
    setEditingQuotationId(quote.id);
    setQuoteError('');
    setEditorModalOpen(true);
  };

  // Live Financial Calculations inside Editor
  const currentCalculations = useMemo(() => {
    const subtotal = formData.items.reduce((acc, it) => {
      const q = parseInt(it.quantity, 10) || 0;
      const p = parseFloat(it.unitPrice) || 0;
      return acc + (q * p);
    }, 0);

    const discount = parseFloat(formData.discount) || 0;
    const taxAndFees = parseFloat(formData.taxAndFees) || 0;
    const totalAmount = Math.max(0, subtotal - discount + taxAndFees);
    const initialPayment = Math.round(totalAmount * 0.5 * 100) / 100;
    const finalPayment = Math.round((totalAmount - initialPayment) * 100) / 100;

    return { subtotal, discount, taxAndFees, totalAmount, initialPayment, finalPayment };
  }, [formData.items, formData.discount, formData.taxAndFees]);

  // Add Item to Quotation Form
  const handleAddLineItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: `custom-${Date.now()}`,
          serviceTitle: 'New Custom Service Deliverable',
          category: 'PLANNING',
          description: '',
          deliverables: '',
          quantity: 1,
          unitPrice: 10000,
          discount: 0,
          specialConditions: '',
          exclusions: '',
          isPartnerConfirmed: false,
          notes: ''
        }
      ]
    }));
  };

  // Add selected catalog service
  const handleAddCatalogService = (serviceId) => {
    if (!serviceId) return;
    const s = catalogServices.find(item => item.id === serviceId);
    if (!s) return;

    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: `cat-${s.id}-${Date.now()}`,
          serviceTitle: s.name,
          category: s.category || 'OTHER',
          description: s.description || '',
          deliverables: Array.isArray(s.inclusions) ? s.inclusions.join(', ') : '',
          quantity: 1,
          unitPrice: Number(s.startingPrice) || 12000,
          discount: 0,
          specialConditions: '',
          exclusions: Array.isArray(s.exclusions) ? s.exclusions.join(', ') : '',
          isPartnerConfirmed: false,
          notes: ''
        }
      ]
    }));
    setSelectedServiceId('');
  };

  // Add selected catalog package
  const handleAddCatalogPackage = (packageId) => {
    if (!packageId) return;
    const p = catalogPackages.find(item => item.id === packageId);
    if (!p) return;

    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: `pkg-${p.id}-${Date.now()}`,
          serviceTitle: `${p.name} (Package)`,
          category: 'PLANNING',
          description: p.description || '',
          deliverables: Array.isArray(p.inclusions) ? p.inclusions.join(', ') : '',
          quantity: 1,
          unitPrice: Number(p.price) || 50000,
          discount: 0,
          specialConditions: 'Inclusions bundled as complete package.',
          exclusions: Array.isArray(p.exclusions) ? p.exclusions.join(', ') : '',
          isPartnerConfirmed: true,
          notes: ''
        }
      ]
    }));
    setSelectedPackageId('');
  };

  // Remove Line Item
  const handleRemoveLineItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index)
    }));
  };

  // Update specific Line Item field
  const handleLineItemChange = (index, field, value) => {
    setFormData(prev => {
      const updated = [...prev.items];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      return { ...prev, items: updated };
    });
  };

  // Submit Quotation (Save Draft OR Issue & Send)
  const handleSubmitQuotation = async (statusToSend = 'SENT') => {
    try {
      setQuoteError('');
      if (!formData.bookingId) {
        setQuoteError('Please select a linked booking request.');
        return;
      }

      if (formData.items.length === 0) {
        setQuoteError('A quotation must contain at least one service line item.');
        return;
      }

      // Check item quantities and prices
      for (const item of formData.items) {
        if (!item.serviceTitle || !item.serviceTitle.trim()) {
          setQuoteError('Every line item must have a valid service title.');
          return;
        }
        if (!item.quantity || Number(item.quantity) <= 0) {
          setQuoteError(`Quantity for "${item.serviceTitle}" must be greater than zero.`);
          return;
        }
        if (item.unitPrice === undefined || Number(item.unitPrice) < 0) {
          setQuoteError(`Unit price for "${item.serviceTitle}" cannot be negative.`);
          return;
        }
      }

      if (currentCalculations.totalAmount <= 0) {
        setQuoteError('Total quotation amount must be greater than zero.');
        return;
      }

      if (editorMode === 'REVISE' && !formData.revisionReason.trim()) {
        setQuoteError('Please specify the reason for revision to maintain audit traceability.');
        return;
      }

      setSubmittingQuote(true);

      const payload = {
        bookingId: formData.bookingId,
        items: formData.items,
        discount: Number(formData.discount) || 0,
        taxAndFees: Number(formData.taxAndFees) || 0,
        paymentTerms: formData.paymentTerms,
        notes: formData.notes,
        expiresAt: formData.expiresAt,
        status: statusToSend
      };

      let result;
      if (editorMode === 'CREATE') {
        result = await api.createQuotation(payload);
        toast.success(statusToSend === 'DRAFT' ? 'Quotation draft saved successfully.' : 'Quotation issued and sent to customer.');
      } else if (editorMode === 'EDIT_DRAFT') {
        result = await api.updateDraftQuotation(editingQuotationId, payload);
        toast.success('Draft quotation updated successfully.');
      } else if (editorMode === 'REVISE') {
        result = await api.reviseQuotation(editingQuotationId, {
          ...payload,
          revisionReason: formData.revisionReason
        });
        toast.success(`Revised quotation v${result.data?.quotation?.version} issued to customer.`);
      }

      setEditorModalOpen(false);
      await loadData(true);

      if (result.data?.quotation) {
        setSelectedQuotationId(result.data.quotation.id);
      }
    } catch (err) {
      console.error('Submit quotation error:', err);
      setQuoteError(err.message || 'Failed to submit quotation.');
      toast.error(err.message || 'Submission error');
    } finally {
      setSubmittingQuote(false);
    }
  };

  // Direct Send action for an existing draft in list/inspector
  const handleDirectSendQuotation = async (quoteId) => {
    try {
      setRefreshing(true);
      await api.sendQuotation(quoteId);
      toast.success('Quotation issued and sent to customer.');
      await loadData(true);
      if (selectedQuotationId === quoteId) {
        const res = await api.getQuotationById(quoteId);
        setSelectedQuotation(res.data?.quotation || res.data);
      }
    } catch (err) {
      toast.error('Failed to issue quotation: ' + (err.message || 'Server error'));
    } finally {
      setRefreshing(false);
    }
  };

  // Navigate to Contract Generation
  const handlePrepareContract = (quote) => {
    if (!quote || quote.status !== 'ACCEPTED') {
      toast.error('Contracts can only be prepared from accepted quotations.');
      return;
    }
    navigate(`/company/contracts?quotationId=${quote.id}&bookingId=${quote.bookingId}`);
  };

  // Open Print / PDF Preview Modal
  const handleOpenPreview = (quote) => {
    setPreviewQuotation(quote);
    setPreviewModalOpen(true);
  };

  // Dedicated seamless A4 Quotation Proposal Printer that prints strictly the document without modal headers or cutoffs
  const handlePrint = () => {
    const el = document.getElementById('printable-quotation-document');
    if (!el) {
      window.print();
      return;
    }

    let printFrame = document.getElementById('eventora-quotation-print-iframe');
    if (!printFrame) {
      printFrame = document.createElement('iframe');
      printFrame.id = 'eventora-quotation-print-iframe';
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);
    }

    const frameDoc = printFrame.contentWindow || printFrame.contentDocument.defaultView;
    const doc = printFrame.contentDocument || printFrame.contentWindow.document;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Eventora Quotation Proposal - ${previewQuotation?.booking?.reference || 'Proposal'}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 12mm 10mm 12mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a;
              background: #ffffff;
              margin: 0;
              padding: 0;
              font-size: 11px;
              line-height: 1.4;
            }
            .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
            .font-bold { font-weight: 700; }
            .font-black { font-weight: 900; }
            .uppercase { text-transform: uppercase; }
            .tracking-wider { letter-spacing: 0.05em; }
            .tracking-widest { letter-spacing: 0.1em; }
            .tracking-tight { letter-spacing: -0.025em; }
            .flex { display: flex; }
            .flex-col { flex-direction: column !important; }
            .flex-row { flex-direction: row !important; }
            .justify-between { justify-content: space-between !important; }
            .justify-center { justify-content: center !important; }
            .justify-end { justify-content: flex-end !important; }
            .items-start { align-items: flex-start !important; }
            .items-center { align-items: center !important; }
            .grid { display: grid; }
            .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
            .gap-4 { gap: 12px; }
            .gap-3 { gap: 10px; }
            .gap-2 { gap: 8px; }
            .gap-1\\.5 { gap: 6px; }
            .gap-8 { gap: 24px; }
            .space-y-6 > * + * { margin-top: 12px; }
            .space-y-4 > * + * { margin-top: 8px; }
            .space-y-2 > * + * { margin-top: 5px; }
            .space-y-1\\.5 > * + * { margin-top: 3px; }
            .space-y-1 > * + * { margin-top: 2px; }
            .text-xl { font-size: 18px; line-height: 22px; }
            .text-sm { font-size: 12.5px; line-height: 16px; }
            .text-xs { font-size: 10.5px; line-height: 14px; }
            .text-\\[10px\\] { font-size: 9px; line-height: 12px; }
            .text-\\[11px\\] { font-size: 10px; line-height: 13px; }
            .text-slate-900 { color: #0f172a; }
            .text-slate-800 { color: #1e293b; }
            .text-slate-700 { color: #334155; }
            .text-slate-600 { color: #475569; }
            .text-slate-500 { color: #64748b; }
            .text-slate-400 { color: #94a3b8; }
            .text-amber-800 { color: #92400e; }
            .text-emerald-600 { color: #059669; }
            .text-\\[\\#F50046\\] { color: #f50046; }
            .bg-slate-50 { background-color: #f8fafc; }
            .bg-slate-100 { background-color: #f1f5f9; }
            .bg-white { background-color: #ffffff; }
            .bg-\\[\\#F50046\\] { background-color: #f50046; }
            .border { border: 1px solid #e2e8f0; }
            .border-b { border-bottom: 1px solid #e2e8f0; }
            .border-t { border-top: 1px solid #e2e8f0; }
            .border-t-2 { border-top: 2px solid #0f172a; }
            .border-b-2 { border-bottom: 2px solid #0f172a; }
            .border-slate-200 { border-color: #e2e8f0; }
            .border-slate-100 { border-color: #f1f5f9; }
            .border-slate-400 { border-color: #94a3b8; }
            .border-slate-900 { border-color: #0f172a; }
            .rounded-xl { border-radius: 8px; }
            .rounded-2xl { border-radius: 12px; }
            .rounded-lg { border-radius: 6px; }
            .rounded { border-radius: 4px; }
            .p-8 { padding: 0; }
            .p-4 { padding: 8px 10px; }
            .p-3\\.5 { padding: 6px 8px; }
            .p-3 { padding: 6px 8px; }
            .p-2\\.5 { padding: 5px 8px; }
            .px-3 { padding-left: 8px; padding-right: 8px; }
            .py-2\\.5 { padding-top: 5px; padding-bottom: 5px; }
            .py-3 { padding-top: 5px; padding-bottom: 5px; }
            .px-2 { padding-left: 6px; padding-right: 6px; }
            .py-0\\.5 { padding-top: 1px; padding-bottom: 1px; }
            .pb-5 { padding-bottom: 8px; }
            .pt-2 { padding-top: 4px; }
            .pt-1 { padding-top: 2px; }
            .pt-8 { padding-top: 16px; }
            .mt-1 { margin-top: 2px; }
            .mt-0\\.5 { margin-top: 1px; }
            .mb-1 { margin-bottom: 2px; }
            .mb-2 { margin-bottom: 4px; }
            .mb-0\\.5 { margin-bottom: 1px; }
            .mb-8 { margin-bottom: 22px; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .overflow-hidden { overflow: hidden; }
            .block { display: block; }
            .inline-block { display: inline-block; }
            .w-7 { width: 22px; }
            .h-7 { height: 22px; }
            .w-full { width: 100%; }
            .max-w-xs { max-width: 250px; }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10px;
            }
            th, td {
              padding: 5px 8px;
              text-align: left;
              border-bottom: 1px solid #e2e8f0;
              vertical-align: top;
            }
            th {
              background: #f1f5f9;
              font-size: 8.5px;
              text-transform: uppercase;
              font-weight: 700;
              color: #475569;
            }
            th:nth-child(1), td:nth-child(1) { width: 55%; }
            th:nth-child(2), td:nth-child(2) { width: 10%; text-align: center; white-space: nowrap; }
            th:nth-child(3), td:nth-child(3) { width: 17%; text-align: right; white-space: nowrap; }
            th:nth-child(4), td:nth-child(4) { width: 18%; text-align: right; white-space: nowrap; font-weight: 700; }
            tr {
              page-break-inside: avoid;
              break-inside: avoid;
            }
          </style>
        </head>
        <body>
          <div style="padding: 0;">
            ${el.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      frameDoc.focus();
      frameDoc.print();
    }, 250);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header with Breadcrumb, Title & Global Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-1">
            <Link to="/company/dashboard" className="hover:text-[#F20047] transition-colors">
              Coordinator Portal
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-700 font-semibold">Quotations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Customer Quotations & Proposals
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Prepare, send, and manage customer quotations with authoritative ETB financial calculations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-60"
            title="Refresh Quotations"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#F20047]' : 'text-slate-500'}`} />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>

          {(user?.role === 'COORDINATOR' || user?.role === 'ADMIN_DIRECTOR') && (
            <button
              onClick={() => {
                if (bookings.length > 0) {
                  initNewQuotationFromBooking(bookings[0]);
                } else {
                  toast.error('No bookings found to create a quotation.');
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#F20047] hover:bg-[#d9003f] text-white text-xs font-bold rounded-xl shadow-sm shadow-[#F20047]/20 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Quotation</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Metric 1: Total */}
        <button
          onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${statusFilter === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>
              Total Quotes
            </span>
            <Layers className={`w-4 h-4 ${statusFilter === 'ALL' ? 'text-slate-300' : 'text-slate-400'}`} />
          </div>
          <div className="text-2xl font-black mt-2 leading-none">{summaryMetrics.total}</div>
          <p className={`text-[11px] mt-1.5 font-medium ${statusFilter === 'ALL' ? 'text-slate-300' : 'text-slate-400'}`}>
            All registered versions
          </p>
        </button>

        {/* Metric 2: Drafts */}
        <button
          onClick={() => { setStatusFilter('DRAFT'); setCurrentPage(1); }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'DRAFT'
              ? 'bg-slate-800 text-white border-slate-800 shadow-md ring-2 ring-slate-400/30'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${statusFilter === 'DRAFT' ? 'text-slate-200' : 'text-slate-600'}`}>
              Draft Quotes
            </span>
            <FileText className={`w-4 h-4 ${statusFilter === 'DRAFT' ? 'text-slate-200' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-black mt-2 leading-none ${statusFilter === 'DRAFT' ? 'text-white' : 'text-slate-800'}`}>
            {summaryMetrics.draft}
          </div>
          <p className={`text-[11px] mt-1.5 font-medium ${statusFilter === 'DRAFT' ? 'text-slate-300' : 'text-slate-400'}`}>
            Unsent work in progress
          </p>
        </button>

        {/* Metric 3: Awaiting Response */}
        <button
          onClick={() => { setStatusFilter('SENT'); setCurrentPage(1); }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'SENT'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/10'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${statusFilter === 'SENT' ? 'text-slate-300' : 'text-slate-500'}`}>
              Awaiting Response
            </span>
            <Clock className={`w-4 h-4 ${statusFilter === 'SENT' ? 'text-slate-300' : 'text-slate-400'}`} />
          </div>
          <div className="text-2xl font-black mt-2 leading-none">{summaryMetrics.sent}</div>
          <p className={`text-[11px] font-medium mt-1.5 ${statusFilter === 'SENT' ? 'text-slate-300' : 'text-slate-400'}`}>
            Pending review
          </p>
        </button>

        {/* Metric 4: Changes Requested */}
        <button
          onClick={() => { setStatusFilter('CHANGE_REQUESTED'); setCurrentPage(1); }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'CHANGE_REQUESTED'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/10'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${statusFilter === 'CHANGE_REQUESTED' ? 'text-slate-300' : 'text-slate-500'}`}>
              Changes Requested
            </span>
            <AlertCircle className={`w-4 h-4 ${statusFilter === 'CHANGE_REQUESTED' ? 'text-slate-300' : 'text-slate-400'}`} />
          </div>
          <div className="text-2xl font-black mt-2 leading-none">{summaryMetrics.changeRequested}</div>
          <p className={`text-[11px] font-medium mt-1.5 ${statusFilter === 'CHANGE_REQUESTED' ? 'text-slate-300' : 'text-slate-400'}`}>
            Revision required
          </p>
        </button>

        {/* Metric 5: Accepted */}
        <button
          onClick={() => { setStatusFilter('ACCEPTED'); setCurrentPage(1); }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'ACCEPTED'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/10'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${statusFilter === 'ACCEPTED' ? 'text-slate-300' : 'text-slate-500'}`}>
              Accepted Quotes
            </span>
            <CheckCircle2 className={`w-4 h-4 ${statusFilter === 'ACCEPTED' ? 'text-slate-300' : 'text-slate-400'}`} />
          </div>
          <div className="text-2xl font-black mt-2 leading-none">{summaryMetrics.accepted}</div>
          <p className={`text-[11px] font-medium mt-1.5 ${statusFilter === 'ACCEPTED' ? 'text-slate-300' : 'text-slate-400'}`}>
            Ready for contract
          </p>
        </button>

        {/* Metric 6: Expired */}
        <button
          onClick={() => { setStatusFilter('EXPIRED'); setCurrentPage(1); }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'EXPIRED'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/10'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${statusFilter === 'EXPIRED' ? 'text-slate-300' : 'text-slate-500'}`}>
              Expired Quotes
            </span>
            <Calendar className={`w-4 h-4 ${statusFilter === 'EXPIRED' ? 'text-slate-300' : 'text-slate-400'}`} />
          </div>
          <div className="text-2xl font-black mt-2 leading-none">{summaryMetrics.expired}</div>
          <p className={`text-[11px] font-medium mt-1.5 ${statusFilter === 'EXPIRED' ? 'text-slate-300' : 'text-slate-400'}`}>
            Past validity
          </p>
        </button>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex-1 w-full md:w-auto flex flex-col sm:flex-row items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search quote ref (QT-...), booking, client, or event..."
              className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#F20047] focus:bg-white transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-auto min-w-[140px]">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-[#F20047] focus:bg-white shadow-2xs cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SENT">Awaiting Response</option>
              <option value="CHANGE_REQUESTED">Changes Requested</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="REJECTED">Declined</option>
              <option value="EXPIRED">Expired</option>
              <option value="SUPERSEDED">Superseded</option>
            </select>
          </div>

          {/* Event Type Filter */}
          <div className="w-full sm:w-auto min-w-[140px]">
            <select
              value={eventTypeFilter}
              onChange={(e) => {
                setEventTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-[#F20047] focus:bg-white shadow-2xs cursor-pointer"
            >
              <option value="ALL">All Event Types</option>
              <option value="WEDDING">Wedding</option>
              <option value="SHIMGLINA">Shimglina Ceremony</option>
              <option value="BIRTHDAY">Birthday</option>
              <option value="CORPORATE">Corporate & Gala</option>
              <option value="ANNIVERSARY">Anniversary</option>
              <option value="CONCERT">Concert</option>
              <option value="EXHIBITION">Exhibition</option>
              <option value="GALA">Gala</option>
              <option value="OTHER">Other Custom Event</option>
            </select>
          </div>
        </div>

        {/* View Mode & Sort Switcher */}
        <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-[#F20047] focus:bg-white shadow-2xs cursor-pointer"
            >
              <option value="DATE_DESC">Newest Created</option>
              <option value="DATE_ASC">Oldest Created</option>
              <option value="AMOUNT_DESC">Highest Amount</option>
              <option value="AMOUNT_ASC">Lowest Amount</option>
              <option value="EXPIRY_ASC">Expiry Date</option>
            </select>
          </div>

          <div className="flex items-center border border-slate-200/90 rounded-xl overflow-hidden bg-slate-50/80 p-0.5 shadow-2xs">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-[#F20047] text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-[#F20047] text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Main Quotations List / Table View */}
      {loading ? (
        <div className="py-24 text-center bg-white rounded-3xl border border-slate-100 shadow-2xs">
          <div className="w-10 h-10 border-3 border-rose-200 border-t-[#F20047] rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs font-bold text-slate-500">Loading quotations registry...</p>
        </div>
      ) : filteredQuotations.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-2xs max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-[#F20047] border border-rose-100 flex items-center justify-center mx-auto mb-4">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No quotations found</h3>
          <p className="text-xs text-slate-500 mt-1 mb-6 max-w-sm mx-auto leading-relaxed">
            {searchQuery || statusFilter !== 'ALL' || eventTypeFilter !== 'ALL'
              ? 'No quotation matches your current filter criteria. Try resetting the filters.'
              : 'There are no active quotations registered yet. Create a quotation from a customer booking request to begin.'}
          </p>
          {searchQuery || statusFilter !== 'ALL' || eventTypeFilter !== 'ALL' ? (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setEventTypeFilter('ALL');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Reset All Filters
            </button>
          ) : (
            <button
              onClick={() => {
                if (bookings.length > 0) initNewQuotationFromBooking(bookings[0]);
                else toast.info('No bookings available.');
              }}
              className="px-5 py-2.5 bg-[#F20047] hover:bg-[#d9003f] text-white text-xs font-bold rounded-xl shadow-md shadow-[#F20047]/20 transition-all cursor-pointer"
            >
              + Create First Quotation
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW - Balanced 7 columns, zero horizontal overflow */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="w-full">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/80 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="py-3 px-3.5">Quotation Ref</th>
                  <th className="py-3 px-3.5">Booking & Event</th>
                  <th className="py-3 px-3.5">Customer</th>
                  <th className="py-3 px-3.5">Event Date</th>
                  <th className="py-3 px-3.5 text-right">Amount (ETB)</th>
                  <th className="py-3 px-3.5 text-center">Status</th>
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedQuotations.map((q) => {
                  const statusConf = STATUS_CONFIG[q.status] || STATUS_CONFIG.DRAFT;
                  const isExpired = q.status === 'SENT' && q.expiresAt && new Date(q.expiresAt) < new Date();
                  const effectiveStatusConf = isExpired ? STATUS_CONFIG.EXPIRED : statusConf;
                  const quoteRef = `QT-${q.booking?.reference || 'EV'}-v${q.version}`;

                  return (
                    <tr
                      key={q.id}
                      onClick={() => setSelectedQuotationId(q.id)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      {/* 1. Reference & Version */}
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80">
                            {quoteRef}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 font-normal">
                          {new Date(q.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      {/* 2. Booking & Title */}
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-900 truncate max-w-[200px]" title={q.booking?.title}>
                          {q.booking?.title || 'Event Booking'}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 truncate max-w-[200px]">
                          {q.booking?.reference} · {q.booking?.eventType}
                        </div>
                      </td>

                      {/* 3. Customer */}
                      <td className="py-3 px-3.5">
                        <div className="font-semibold text-slate-800 truncate max-w-[160px]" title={q.booking?.customer?.fullName}>
                          {q.booking?.customer?.fullName || 'Client'}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                          {q.booking?.customer?.phone || q.booking?.customer?.email || 'Authorized Client'}
                        </div>
                      </td>

                      {/* 4. Event Date & Guests */}
                      <td className="py-3 px-3.5">
                        <div className="font-medium text-slate-700">
                          {q.booking?.preferredDate ? new Date(q.booking.preferredDate).toLocaleDateString() : 'Pending'}
                        </div>
                        <div className="text-[11px] text-slate-400 font-normal">
                          {q.booking?.guestCount ? `${q.booking.guestCount} guests` : 'Guest count TBD'}
                        </div>
                      </td>

                      {/* 5. Total Amount & 50% Milestone */}
                      <td className="py-3 px-3.5 text-right font-mono">
                        <div className="font-black text-slate-900 text-xs">
                          {Number(q.totalAmount).toLocaleString()} ETB
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          50%: {Number(q.initialPaymentRequired).toLocaleString()} ETB
                        </div>
                        {Number(q.discount) > 0 && (
                          <div className="text-[10px] text-emerald-600 font-semibold">
                            -{Number(q.discount).toLocaleString()} discount
                          </div>
                        )}
                      </td>

                      {/* 6. Status */}
                      <td className="py-3 px-3.5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${effectiveStatusConf.bg} ${effectiveStatusConf.text} ${effectiveStatusConf.border} whitespace-nowrap`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${effectiveStatusConf.dot}`}></span>
                          {effectiveStatusConf.label}
                        </span>
                      </td>

                      {/* 7. Actions */}
                      <td className="py-3 px-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedQuotationId(q.id)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                            title="Inspect Quotation"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleOpenPreview(q)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                            title="Preview & Print"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {q.status === 'DRAFT' && (
                            <>
                              <button
                                onClick={() => handleEditDraft(q)}
                                className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors cursor-pointer"
                                title="Edit Draft"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDirectSendQuotation(q.id)}
                                className="px-2 py-1 rounded-lg bg-[#F20047] hover:bg-[#d9003f] text-white text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                                title="Issue & Send to Customer"
                              >
                                <Send className="w-3 h-3" />
                                <span>Send</span>
                              </button>
                            </>
                          )}

                          {q.status === 'CHANGE_REQUESTED' && (
                            <button
                              onClick={() => handleReviseQuotation(q)}
                              className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                              title="Revise Quotation"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Revise</span>
                            </button>
                          )}

                          {q.status === 'ACCEPTED' && (
                            <button
                              onClick={() => handlePrepareContract(q)}
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                              title="Prepare Contract"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Contract</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginatedQuotations.map((q) => {
            const statusConf = STATUS_CONFIG[q.status] || STATUS_CONFIG.DRAFT;
            const quoteRef = `QT-${q.booking?.reference || 'EV'}-v${q.version}`;

            return (
              <div
                key={q.id}
                onClick={() => setSelectedQuotationId(q.id)}
                className="bg-white rounded-2xl border border-slate-100 shadow-2xs p-5 hover:shadow-md hover:border-slate-200 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      {quoteRef}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusConf.bg} ${statusConf.text} ${statusConf.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`}></span>
                      {statusConf.label}
                    </span>
                  </div>

                  <h3 className="font-black text-slate-900 text-sm leading-snug line-clamp-1">
                    {q.booking?.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 mb-3">
                    Client: <strong className="text-slate-800">{q.booking?.customer?.fullName}</strong>
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl mb-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Date</span>
                      <span className="font-semibold text-slate-700">
                        {q.booking?.preferredDate ? new Date(q.booking.preferredDate).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Guests</span>
                      <span className="font-semibold text-slate-700">{q.booking?.guestCount || 0} guests</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Total</span>
                      <span className="font-black text-slate-900">{Number(q.totalAmount).toLocaleString()} ETB</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">50% Deposit</span>
                      <span className="font-mono text-slate-600 font-semibold">{Number(q.initialPaymentRequired).toLocaleString()} ETB</span>
                    </div>
                  </div>

                  {q.customerResponseNote && (
                    <div className="mb-3 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900">
                      <span className="font-bold text-[10px] uppercase block text-amber-700">Customer Feedback:</span>
                      <p className="line-clamp-2 mt-0.5">{q.customerResponseNote}</p>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleOpenPreview(q)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                    title="Print Document"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-1.5 ml-auto">
                    {q.status === 'DRAFT' && (
                      <button
                        onClick={() => handleDirectSendQuotation(q.id)}
                        className="px-3 py-1.5 rounded-xl bg-[#F50046] hover:bg-[#d0003b] text-white text-xs font-bold transition flex items-center gap-1 shadow-xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send to Customer</span>
                      </button>
                    )}

                    {q.status === 'CHANGE_REQUESTED' && (
                      <button
                        onClick={() => handleReviseQuotation(q)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Revise</span>
                      </button>
                    )}

                    {q.status === 'ACCEPTED' && (
                      <button
                        onClick={() => handlePrepareContract(q)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Prepare Contract</span>
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedQuotationId(q.id)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1"
                    >
                      <span>View</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Pagination Bar */}
      {!loading && filteredQuotations.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
            <span>
              Showing <strong className="text-slate-900 font-bold">{startIndex + 1}</strong> to{' '}
              <strong className="text-slate-900 font-bold">{endIndex}</strong> of{' '}
              <strong className="text-slate-900 font-bold">{filteredQuotations.length}</strong> quotations
            </span>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Rows:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="pl-2 pr-6 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 cursor-pointer"
              >
                <option value={4}>4</option>
                <option value={8}>8</option>
                <option value={16}>16</option>
                <option value={32}>32</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={safeCurrentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-bold text-slate-700">
              Page {safeCurrentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={safeCurrentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          6. QUOTATION INSPECTOR & HISTORY DRAWER
          ======================================================== */}
      {selectedQuotationId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end animate-in fade-in">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col justify-between overflow-y-auto text-slate-800">
            {/* Drawer Header */}
            <div>
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900 bg-white border border-slate-200 px-2.5 py-1 rounded-md shadow-2xs">
                      QT-{selectedQuotation?.booking?.reference}-v{selectedQuotation?.version}
                    </span>
                    {selectedQuotation && (
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_CONFIG[selectedQuotation.status]?.bg || 'bg-slate-100'} ${STATUS_CONFIG[selectedQuotation.status]?.text || 'text-slate-700'}`}>
                        {STATUS_CONFIG[selectedQuotation.status]?.label || selectedQuotation.status}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-black text-slate-900 mt-2">
                    {selectedQuotation?.booking?.title || 'Quotation Details'}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {selectedQuotation && (
                    <button
                      onClick={() => handleOpenPreview(selectedQuotation)}
                      className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white transition shadow-2xs"
                      title="Preview Document"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedQuotationId(null)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {loadingDetails ? (
                <div className="py-20 text-center">
                  <div className="w-8 h-8 border-2 border-rose-200 border-t-[#F50046] rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-xs font-semibold text-slate-500">Loading quotation details...</p>
                </div>
              ) : selectedQuotation ? (
                <div className="p-6 space-y-6">
                  {/* Customer & Event Details */}
                  <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Customer</span>
                      <span className="font-bold text-slate-900">{selectedQuotation.booking?.customer?.fullName}</span>
                      <div className="text-[11px] text-slate-500">{selectedQuotation.booking?.customer?.phone || selectedQuotation.booking?.customer?.email}</div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Booking Reference</span>
                      <span className="font-mono font-bold text-slate-900">{selectedQuotation.booking?.reference}</span>
                      <div className="text-[11px] text-slate-500">{selectedQuotation.booking?.eventType}</div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Event Schedule</span>
                      <span className="font-semibold text-slate-700">
                        {selectedQuotation.booking?.preferredDate ? new Date(selectedQuotation.booking.preferredDate).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Guest Count</span>
                      <span className="font-semibold text-slate-700">{selectedQuotation.booking?.guestCount} attendees</span>
                    </div>
                  </div>

                  {/* Customer Feedback if Changes Requested */}
                  {selectedQuotation.customerResponseNote && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-amber-800 text-[11px]">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>Customer Feedback ({new Date(selectedQuotation.respondedAt).toLocaleDateString()}):</span>
                      </div>
                      <p className="leading-relaxed bg-white/70 p-2.5 rounded-xl border border-amber-200/60 font-medium">
                        "{selectedQuotation.customerResponseNote}"
                      </p>
                    </div>
                  )}

                  {/* Line Items Breakdown */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                        Itemized Services ({selectedQuotation.lineItems?.length || 0})
                      </h4>
                      <span className="text-[11px] font-semibold text-slate-500">Currency: ETB</span>
                    </div>

                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Service & Deliverables</th>
                            <th className="py-2.5 px-3 text-center">Qty</th>
                            <th className="py-2.5 px-3 text-right">Unit Price</th>
                            <th className="py-2.5 px-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedQuotation.lineItems?.map((it) => (
                            <tr key={it.id} className="hover:bg-slate-50/50">
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-900">{it.serviceTitle}</div>
                                {it.deliverables && (
                                  <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                                    Deliverables: {it.deliverables}
                                  </div>
                                )}
                                {it.specialConditions && (
                                  <div className="text-[10px] text-amber-700 font-medium mt-0.5">
                                    Condition: {it.specialConditions}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center font-bold text-slate-700">
                                {it.quantity}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-slate-600">
                                {Number(it.unitPrice).toLocaleString()}
                              </td>
                              <td className="py-3 px-3 text-right font-bold text-slate-900 font-mono">
                                {Number(it.lineTotal).toLocaleString()} ETB
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Financial Settlement Breakdown */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Services Subtotal:</span>
                      <span className="font-mono font-bold">{Number(selectedQuotation.subtotal).toLocaleString()} ETB</span>
                    </div>
                    {Number(selectedQuotation.discount) > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Negotiated Discount:</span>
                        <span className="font-mono font-bold">-{Number(selectedQuotation.discount).toLocaleString()} ETB</span>
                      </div>
                    )}
                    {Number(selectedQuotation.taxAndFees) > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>Additional Charges / Fees:</span>
                        <span className="font-mono font-bold">+{Number(selectedQuotation.taxAndFees).toLocaleString()} ETB</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-black text-slate-900">
                      <span>Total Proposal Amount:</span>
                      <span className="text-[#F50046] font-mono">{Number(selectedQuotation.totalAmount).toLocaleString()} ETB</span>
                    </div>

                    {/* Standard 50% / 50% split */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/80 text-[11px]">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">50% Initial Payment</span>
                        <span className="font-mono font-bold text-slate-800">{Number(selectedQuotation.initialPaymentRequired).toLocaleString()} ETB</span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">Due upon signing</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">50% Final Payment</span>
                        <span className="font-mono font-bold text-slate-800">{Number(selectedQuotation.finalPaymentDue).toLocaleString()} ETB</span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">Due after event delivery</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Terms & Notes */}
                  <div className="space-y-3 text-xs">
                    {selectedQuotation.paymentTerms && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Payment Terms</span>
                        <p className="text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          {selectedQuotation.paymentTerms}
                        </p>
                      </div>
                    )}
                    {selectedQuotation.notes && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Commercial Notes</span>
                        <p className="text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          {selectedQuotation.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Drawer Actions Footer */}
            {selectedQuotation && (
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
                <button
                  onClick={() => setSelectedQuotationId(null)}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition shadow-2xs"
                >
                  Close
                </button>

                <div className="flex items-center gap-2">
                  {selectedQuotation.status === 'DRAFT' && (
                    <>
                      <button
                        onClick={() => handleEditDraft(selectedQuotation)}
                        className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Draft</span>
                      </button>
                      <button
                        onClick={() => handleDirectSendQuotation(selectedQuotation.id)}
                        className="px-4 py-2 rounded-xl bg-[#F50046] hover:bg-[#d0003b] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-rose-500/20"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send to Customer</span>
                      </button>
                    </>
                  )}

                  {['SENT', 'CHANGE_REQUESTED'].includes(selectedQuotation.status) && (
                    <button
                      onClick={() => handleReviseQuotation(selectedQuotation)}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Create Revision (v{selectedQuotation.version + 1})</span>
                    </button>
                  )}

                  {selectedQuotation.status === 'ACCEPTED' && (
                    <button
                      onClick={() => handlePrepareContract(selectedQuotation)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Prepare Contract</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          7. QUOTATION EDITOR MODAL (Create, Edit Draft, Revise)
          ======================================================== */}
      {editorModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] shadow-2xl border border-slate-200 flex flex-col text-slate-800 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {editorMode === 'CREATE' && 'Create Quotation Proposal'}
                  {editorMode === 'EDIT_DRAFT' && 'Edit Draft Quotation'}
                  {editorMode === 'REVISE' && `Create Revised Quotation Version`}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Accurate line items, deliverable conditions, and 50/50 payment split calculations in ETB.
                </p>
              </div>
              <button
                onClick={() => setEditorModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {quoteError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{quoteError}</span>
                </div>
              )}

              {/* 1. Linked Booking Header */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  1. Linked Customer Booking Request *
                </label>
                {editorMode === 'CREATE' ? (
                  <select
                    value={formData.bookingId}
                    onChange={(e) => {
                      const b = bookings.find(item => item.id === e.target.value);
                      if (b) initNewQuotationFromBooking(b);
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F50046] cursor-pointer"
                  >
                    {bookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title} ({b.reference}) · {b.customer?.fullName} · {b.guestCount} guests
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
                    Linked Booking: <strong className="text-slate-900">{bookings.find(b => b.id === formData.bookingId)?.title || formData.bookingId}</strong>
                  </div>
                )}
              </div>

              {/* If Revision, specify revision reason */}
              {editorMode === 'REVISE' && (
                <div>
                  <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Revision Reason & Audit Explanation *</span>
                  </label>
                  <textarea
                    rows={2}
                    value={formData.revisionReason}
                    onChange={(e) => setFormData(prev => ({ ...prev, revisionReason: e.target.value }))}
                    placeholder="Explain what changed and why (e.g., Added extra floral centerpieces as requested by client)..."
                    className="w-full p-3 bg-amber-50/40 border border-amber-200 rounded-xl text-xs text-slate-800 placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
              )}

              {/* 2. Service Line Items Section */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      2. Service Line Items ({formData.items.length})
                    </h4>
                    <p className="text-[11px] text-slate-400">Add services independently or bundle an agreed package.</p>
                  </div>

                  {/* Add Service Helpers */}
                  <div className="flex items-center gap-2">
                    {/* Add From Service Catalog */}
                    <select
                      value={selectedServiceId}
                      onChange={(e) => handleAddCatalogService(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
                    >
                      <option value="">+ Add From Service Catalog</option>
                      {catalogServices.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.category}) · {Number(s.startingPrice).toLocaleString()} ETB
                        </option>
                      ))}
                    </select>

                    {/* Add Package */}
                    <select
                      value={selectedPackageId}
                      onChange={(e) => handleAddCatalogPackage(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
                    >
                      <option value="">+ Add Curated Package</option>
                      {catalogPackages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.eventType}) · {Number(p.price).toLocaleString()} ETB
                        </option>
                      ))}
                    </select>

                    {/* Add Custom Item */}
                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Custom Item</span>
                    </button>
                  </div>
                </div>

                {/* Line Items List */}
                <div className="space-y-3">
                  {formData.items.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-4 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-3 relative group"
                    >
                      {/* Row 1: Title, Category, Qty, Unit Price, Line Total, Delete */}
                      <div className="grid grid-cols-12 gap-2.5 items-center">
                        <div className="col-span-12 sm:col-span-4">
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Service Title *</label>
                          <input
                            type="text"
                            value={item.serviceTitle}
                            onChange={(e) => handleLineItemChange(idx, 'serviceTitle', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#F50046]"
                            placeholder="e.g. Traditional Wedding Stage Decoration"
                            required
                          />
                        </div>

                        <div className="col-span-6 sm:col-span-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Category</label>
                          <select
                            value={item.category || 'OTHER'}
                            onChange={(e) => handleLineItemChange(idx, 'category', e.target.value)}
                            className="w-full px-2 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                          >
                            {SERVICE_CATEGORIES.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-3 sm:col-span-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleLineItemChange(idx, 'quantity', e.target.value)}
                            className="w-full px-2 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 text-center focus:outline-none focus:border-[#F50046]"
                            required
                          />
                        </div>

                        <div className="col-span-5 sm:col-span-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Unit Price (ETB)</label>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={item.unitPrice}
                            onChange={(e) => handleLineItemChange(idx, 'unitPrice', e.target.value)}
                            className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-800 text-right focus:outline-none focus:border-[#F50046]"
                            required
                          />
                        </div>

                        <div className="col-span-5 sm:col-span-2 text-right">
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Total</label>
                          <div className="py-2 px-1 text-xs font-black font-mono text-slate-900 truncate">
                            {((parseInt(item.quantity, 10) || 0) * (parseFloat(item.unitPrice) || 0)).toLocaleString()} ETB
                          </div>
                        </div>

                        <div className="col-span-2 sm:col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(idx)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Remove Line Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Row 2: Deliverables & Special Conditions */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                        <div>
                          <input
                            type="text"
                            value={item.deliverables || ''}
                            onChange={(e) => handleLineItemChange(idx, 'deliverables', e.target.value)}
                            placeholder="Deliverables / Scope (e.g. 5x Master Flash lighting, 1x 4K Drone)..."
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#F50046]"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            value={item.specialConditions || ''}
                            onChange={(e) => handleLineItemChange(idx, 'specialConditions', e.target.value)}
                            placeholder="Special conditions or exclusions (e.g. Hall setup access required at 08:00 AM)..."
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#F50046]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Pricing Summary & Settlement Section */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  3. Pricing Summary & Schedule Calculations
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Subtotal (ETB)</label>
                    <div className="px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-xs text-slate-800">
                      {currentCalculations.subtotal.toLocaleString()} ETB
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Negotiated Discount (ETB)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.discount}
                      onChange={(e) => setFormData(prev => ({ ...prev, discount: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-800 font-bold focus:outline-none focus:border-[#F50046]"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Taxes / Additional Fees (ETB)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.taxAndFees}
                      onChange={(e) => setFormData(prev => ({ ...prev, taxAndFees: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-800 font-bold focus:outline-none focus:border-[#F50046]"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500">Authoritative Quotation Total:</span>
                    <div className="text-xl font-black text-[#F50046] font-mono">
                      {currentCalculations.totalAmount.toLocaleString()} ETB
                    </div>
                  </div>

                  {/* 50 / 50 Standard Eventora Rule Preview */}
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-right">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">50% Initial Deposit</span>
                      <span className="font-mono font-black text-xs text-slate-800">
                        {currentCalculations.initialPayment.toLocaleString()} ETB
                      </span>
                    </div>
                    <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-right">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">50% Post-Event Due</span>
                      <span className="font-mono font-black text-xs text-slate-800">
                        {currentCalculations.finalPayment.toLocaleString()} ETB
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Terms, Validity & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Quotation Expiry Date *
                  </label>
                  <input
                    type="date"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#F50046]"
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Standard validity is 14 days from issuance.</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Standard Payment Terms
                  </label>
                  <input
                    type="text"
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData(prev => ({ ...prev, paymentTerms: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#F50046]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Customer Proposal Notes / Overview
                  </label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Enter introductory overview, theme specifications, or custom remarks for the client..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#F50046]"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setEditorModalOpen(false)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 transition shadow-2xs"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={submittingQuote}
                  onClick={() => handleSubmitQuotation('DRAFT')}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition disabled:opacity-50"
                >
                  Save as Draft
                </button>

                <button
                  type="button"
                  disabled={submittingQuote}
                  onClick={() => handleSubmitQuotation('SENT')}
                  className="px-5 py-2 bg-[#F50046] hover:bg-[#d0003b] text-white text-xs font-bold rounded-xl shadow-md shadow-rose-500/20 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{editorMode === 'REVISE' ? 'Issue Revision' : 'Issue & Send to Customer'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          8. LIVE QUOTATION PREVIEW & PRINT MODAL
          ======================================================== */}
      {previewModalOpen && previewQuotation && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-slate-800">
            {/* Header Toolbar */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-bold text-slate-800">Formal Quotation Proposal Preview</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="px-3.5 py-1.5 bg-[#F50046] hover:bg-[#d0003b] text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Save PDF</span>
                </button>
                <button
                  onClick={() => setPreviewModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Document Sheet (A4 Format) */}
            <div id="printable-quotation-document" className="p-8 overflow-y-auto space-y-6 print:p-0 print:m-0" ref={printableAreaRef}>
              {/* Document Header with Eventora Brand */}
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 bg-[#F50046] text-white rounded-lg flex items-center justify-center font-black text-sm">
                      E
                    </span>
                    <span className="text-xl font-black tracking-tight text-slate-900">Eventora</span>
                  </div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">
                    Event Management & Production
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Bole Medhanialem, Addis Ababa, Ethiopia · +251 911 234 567 · contact@eventora.com
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-800 block mb-1">
                    QT-{previewQuotation.booking?.reference}-v{previewQuotation.version}
                  </span>
                  <div className="text-xs font-bold text-slate-900">
                    Date: {new Date(previewQuotation.createdAt).toLocaleDateString()}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Expires: {previewQuotation.expiresAt ? new Date(previewQuotation.expiresAt).toLocaleDateString() : 'In 14 Days'}
                  </div>
                </div>
              </div>

              {/* Bill To & Event Details */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Prepared For</span>
                  <div className="font-bold text-slate-900">{previewQuotation.booking?.customer?.fullName}</div>
                  <div className="text-slate-600">{previewQuotation.booking?.customer?.phone || previewQuotation.booking?.customer?.email}</div>
                  <div className="text-slate-500 mt-1">Client Reference: {previewQuotation.booking?.reference}</div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Event Summary</span>
                  <div className="font-bold text-slate-900">{previewQuotation.booking?.title}</div>
                  <div className="text-slate-600">
                    Date: {previewQuotation.booking?.preferredDate ? new Date(previewQuotation.booking.preferredDate).toLocaleDateString() : 'N/A'} · {previewQuotation.booking?.guestCount} Guests
                  </div>
                  <div className="text-slate-500 mt-1">Location: {previewQuotation.booking?.locationName || 'Addis Ababa'}</div>
                </div>
              </div>

              {/* Scope Overview */}
              {previewQuotation.notes && (
                <div className="p-3.5 bg-slate-50/60 rounded-xl border border-slate-100 text-xs">
                  <span className="font-bold text-slate-800 block mb-0.5">Commercial Scope & Agenda:</span>
                  <p className="text-slate-600 leading-relaxed">{previewQuotation.notes}</p>
                </div>
              )}

              {/* Itemized Services Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Service & Deliverable Specification</th>
                      <th className="py-2.5 px-3 w-16 text-center whitespace-nowrap">Qty</th>
                      <th className="py-2.5 px-3 w-28 text-right whitespace-nowrap">Unit Price</th>
                      <th className="py-2.5 px-3 w-32 text-right whitespace-nowrap">Amount (ETB)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {resolveQuotationLineItems(previewQuotation).map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{it.serviceTitle}</div>
                          {it.deliverables && (
                            <div className="text-[11px] text-slate-500 mt-0.5">{it.deliverables}</div>
                          )}
                          {it.specialConditions && (
                            <div className="text-[10px] text-amber-800 font-medium mt-0.5">Note: {it.specialConditions}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700 whitespace-nowrap font-mono">{it.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600 whitespace-nowrap">{Number(it.unitPrice).toLocaleString()} ETB</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono whitespace-nowrap">{Number(it.lineTotal).toLocaleString()} ETB</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Settlement Totals */}
              <div className="flex justify-end">
                <div className="w-full max-w-xs space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono font-bold">{Number(previewQuotation.subtotal).toLocaleString()} ETB</span>
                  </div>
                  {Number(previewQuotation.discount) > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount:</span>
                      <span className="font-mono font-bold">-{Number(previewQuotation.discount).toLocaleString()} ETB</span>
                    </div>
                  )}
                  {Number(previewQuotation.taxAndFees) > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Taxes & Additional Charges:</span>
                      <span className="font-mono font-bold">+{Number(previewQuotation.taxAndFees).toLocaleString()} ETB</span>
                    </div>
                  )}
                  <div className="pt-2 border-t-2 border-slate-900 flex justify-between text-sm font-black text-slate-900">
                    <span>Total (ETB):</span>
                    <span className="text-[#F50046] font-mono">{Number(previewQuotation.totalAmount).toLocaleString()} ETB</span>
                  </div>
                </div>
              </div>

              {/* Standard 50/50 Payment Schedule */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="font-bold text-slate-900 block mb-1">Standard Payment Schedule (Eventora v1.2)</span>
                <p className="text-slate-600 text-[11px] mb-2">{previewQuotation.paymentTerms}</p>
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">50% Initial Payment</span>
                    <span className="font-mono font-black text-slate-900">{Number(previewQuotation.initialPaymentRequired).toLocaleString()} ETB</span>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">50% Final Settlement</span>
                    <span className="font-mono font-black text-slate-900">{Number(previewQuotation.finalPaymentDue).toLocaleString()} ETB</span>
                  </div>
                </div>
              </div>

              {/* Signatures & Acceptance Notice */}
              <div className="pt-8 grid grid-cols-2 gap-8 text-xs border-t border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-8">Issued By Coordinator:</span>
                  <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
                    {previewQuotation.createdBy?.fullName || 'Eventora Lead Producer'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-8">Client Acceptance Signature:</span>
                  <div className="border-t border-slate-400 pt-1 text-slate-400">
                    {previewQuotation.status === 'ACCEPTED' ? `Accepted by ${previewQuotation.booking?.customer?.fullName} on ${new Date(previewQuotation.respondedAt).toLocaleDateString()}` : 'Pending Client Acceptance'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

