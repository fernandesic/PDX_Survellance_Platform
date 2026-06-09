import { useTheme } from './ThemeContext';


export function useThemeColors() {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    return {

        bg: {
            primary: isLight ? 'bg-white' : 'bg-[#060D1A]',
            secondary: isLight ? 'bg-gray-50' : 'bg-[#0F1419]',
            card: isLight ? 'bg-white border border-gray-200' : 'bg-[#060D1A] border border-[#111A2E]',
        },

        text: {
            primary: isLight ? 'text-[#1a1a1a]' : 'text-white',
            secondary: isLight ? 'text-gray-600' : 'text-gray-400',
            muted: isLight ? 'text-gray-500' : 'text-gray-300',
            inverse: isLight ? 'text-white' : 'text-[#1a1a1a]',
        },

        border: {
            default: isLight ? 'border-gray-300' : 'border-[#111A2E]',
            light: isLight ? 'border-gray-200' : 'border-[#111A2E]/50',
            strong: isLight ? 'border-gray-400' : 'border-[#111A2E]',
        },


        cards: {
            card1: {
                bg: isLight ? 'bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200' : 'bg-gradient-to-br from-emerald-950/80 to-emerald-900/60 border border-emerald-500/20',
                icon: isLight ? 'text-[#0093D5]' : 'text-emerald-300',
                iconBg: isLight ? 'bg-blue-100' : 'bg-emerald-500/20',
                label: isLight ? 'text-blue-700' : 'text-emerald-200/80',
                sub: isLight ? 'text-blue-600/70' : 'text-emerald-300/60',
            },
            card2: {
                bg: isLight ? 'bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200' : 'bg-gradient-to-br from-teal-950/80 to-teal-900/60 border border-teal-500/20',
                icon: isLight ? 'text-teal-600' : 'text-teal-300',
                iconBg: isLight ? 'bg-teal-100' : 'bg-teal-500/20',
                label: isLight ? 'text-teal-700' : 'text-teal-200/80',
                sub: isLight ? 'text-teal-600/70' : 'text-teal-300/60',
            },
            card3: {
                bg: isLight ? 'bg-gradient-to-br from-green-50 to-lime-50 border border-green-200' : 'bg-gradient-to-br from-green-950/80 to-green-900/60 border border-green-500/20',
                icon: isLight ? 'text-green-600' : 'text-green-300',
                iconBg: isLight ? 'bg-green-100' : 'bg-green-500/20',
                label: isLight ? 'text-green-700' : 'text-green-200/80',
                sub: isLight ? 'text-green-600/70' : 'text-green-300/60',
            },
        },


        button: {
            primary: isLight ? 'bg-[#0093D5] hover:bg-[#0080BD] text-white' : 'bg-[#0C7AE9] hover:bg-[#0B6DD1] text-white',
            secondary: isLight ? 'bg-gray-200 hover:bg-gray-300 text-[#1a1a1a]' : 'bg-[#2a2e39] hover:bg-[#363a45] text-white',
            success: isLight ? 'bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700' : 'bg-emerald-900/30 hover:bg-emerald-800/40 border border-emerald-500/20 text-emerald-200',
        },


        dropdown: {
            button: isLight ? 'bg-gray-200 hover:bg-gray-300 text-[#1a1a1a]' : 'bg-[#2a2e39] hover:bg-[#363a45] text-white',
            menu: isLight ? 'bg-white border-gray-300' : 'bg-[#1e222d] border-[#2a2e39]',
            item: isLight ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 hover:bg-[#2a2e39]',
            itemActive: isLight ? 'bg-gray-200 text-[#0093D5]' : 'bg-[#2a2e39] text-blue-400',
        },


        chart: {
            bg: isLight ? 'bg-white border border-gray-200' : 'bg-gradient-to-br from-emerald-950/60 to-emerald-900/40 border border-emerald-500/20',
            bg2: isLight ? 'bg-white border border-gray-200' : 'bg-gradient-to-br from-teal-950/60 to-teal-900/40 border border-teal-500/20',
            centerFill: isLight ? '#f9fafb' : '#081D10',
            stroke: isLight ? '#e5e7eb' : '#081D10',
            barBg: isLight ? 'bg-gray-200' : 'bg-[#0F3B27]',
            barFill: 'bg-gradient-to-r from-green-400 to-green-600',
        },


        chwPipeline: {
            container: isLight ? 'bg-white text-[#1a1a1a] border border-gray-200' : 'bg-[#081D10] text-white',
            topRegion: {
                border: isLight ? 'border-[#0093D5]' : 'border-[#16A249]',
                bg: isLight ? 'bg-[#0093D5]/10' : 'bg-[#16A24933]',
                text: isLight ? 'text-[#0093D5]' : 'text-[#16A249]',
                icon: isLight ? 'text-[#0093D5]' : 'text-[#16A249]',
            },
            badge: isLight ? 'bg-gray-100 border border-gray-300 text-gray-700' : 'bg-[#F9FAFB80] border border-[#DAE0E7]',
        },

        pipBrand: {
            primary: isLight ? 'text-[#0D9488]' : 'text-[#2DD4BF]',
            bg: isLight ? 'bg-[#0D9488]' : 'bg-[#2DD4BF]',
            light: isLight ? 'bg-teal-50' : 'bg-teal-900/30',
            border: isLight ? 'border-teal-200' : 'border-teal-500/30',
            accent: isLight ? '#0D9488' : '#2DD4BF',
        },


        raw: {
            chartCenter: isLight ? '#f9fafb' : '#081D10',
            chartStroke: isLight ? '#e5e7eb' : '#081D10',
            primary: isLight ? '#0093D5' : '#0C7AE9',
            success: isLight ? '#16A249' : '#10b981',
        }
    };
}
